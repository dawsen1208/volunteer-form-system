suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
  library(stringr)
  library(jsonlite)
})

options(stringsAsFactors = FALSE)

# ==========================================================
# recommend_engine.R
#
# Purpose:
#   Read JSON input from stdin
#   Build recommendation results for formType 01 / 02
#   Output JSON to stdout
#
# Input JSON example:
# {
#   "formType": "01",
#   "score": 602,
#   "rank": null,
#   "majorPreferences": ["计算机", "软件工程"],
#   "topN": 20
# }
#
# Output JSON example:
# {
#   "ok": true,
#   "mode": "recommendation_scoring",
#   "formType": "01",
#   "items": [...]
# }
# ==========================================================


# ==========================================================
# 0. CONFIG
# ==========================================================

# 说明：
# 这里先假设将来你的项目目录中会有 backend/data/
# 你现在可以先改成你本机实际路径测试
#
# 如果后面我们按项目结构放置文件，你只需要把下面两行改回相对路径逻辑即可

BASE_DIR <- normalizePath(getwd(), winslash = "/", mustWork = FALSE)

# 如果你当前先本地单独测试，可改成绝对路径，例如：
# DATA_DIR <- "C:/Users/丁叙然/Desktop/volunteer_data/data"

args <- commandArgs(trailingOnly = TRUE)
get_arg <- function(flag) {
  idx <- which(args == flag)
  if (length(idx) == 0) return(NA_character_)
  if (idx[1] >= length(args)) return(NA_character_)
  args[idx[1] + 1]
}

INPUT_PATH <- get_arg("--input")
DATA1_PATH <- get_arg("--data1")
DATA2_PATH <- get_arg("--data2")

DATA_DIR <- file.path(BASE_DIR, "data")
legacy_dir <- file.path(BASE_DIR, "backend", "data")
if (dir.exists(legacy_dir)) {
  DATA_DIR <- legacy_dir
}

FILE_01 <- if (!is.na(DATA1_PATH) && nzchar(DATA1_PATH)) DATA1_PATH else file.path(DATA_DIR, "admission_training_data_01.xlsx")
FILE_02 <- if (!is.na(DATA2_PATH) && nzchar(DATA2_PATH)) DATA2_PATH else file.path(DATA_DIR, "admission_training_data_02.xlsx")

MAJOR_GROUPS <- list(
  "计算机" = c("计算机", "软件", "人工智能", "数据科学", "大数据", "网络工程", "信息安全",
            "物联网", "智能科学", "云计算", "数字媒体技术"),
  "电子信息" = c("电子", "通信", "微电子", "集成电路", "光电", "自动化", "电气"),
  "经济管理" = c("经济", "金融", "会计", "财务", "工商管理", "市场营销", "人力资源", "国际经济"),
  "医学健康" = c("临床", "口腔", "护理", "药学", "中医学", "医学检验", "公共卫生"),
  "教育语言" = c("教育", "师范", "汉语", "英语", "翻译", "商务英语", "学前教育"),
  "法学传媒" = c("法学", "社会学", "新闻", "传播", "广告", "编辑出版"),
  "土木机械" = c("土木", "建筑", "机械", "材料", "工程管理", "车辆", "能源"),
  "化学生物" = c("化学", "生物", "生物技术", "环境", "食品", "制药"),
  "艺术设计" = c("美术", "设计", "视觉传达", "环境设计", "产品设计", "动画", "广播电视编导", "戏剧影视", "音乐", "舞蹈")
)


# ==========================================================
# 1. LOGGING
# ==========================================================

# 注意：
# 所有日志都输出到 stderr，避免污染 stdout 的 JSON 结果
log_err <- function(...) {
  cat(..., "\n", file = stderr())
}


# ==========================================================
# 2. HELPERS
# ==========================================================

safe_numeric <- function(x) {
  x <- as.character(x)
  x <- gsub(",", "", x)
  x <- gsub("\\s+", "", x)
  suppressWarnings(as.numeric(x))
}

normalize_text <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- str_replace_all(x, "[[:space:]]+", "")
  x
}

normalize_form_type <- function(x) {
  x <- normalize_text(x)
  x <- tolower(x)
  
  if (x %in% c("01", "本科", "undergrad", "benke")) return("01")
  if (x %in% c("02", "专科", "junior", "zhuanke")) return("02")
  
  return("01")
}

clean_major_name <- function(x) {
  x <- normalize_text(x)
  # 去掉可能存在的专业代码前缀
  x <- sub("^[A-Za-z0-9]+", "", x)
  x <- normalize_text(x)
  x
}

validate_top_n <- function(x, default_value = 10L, max_value = 50L) {
  v <- suppressWarnings(as.integer(x))
  if (is.na(v) || v <= 0) v <- default_value
  if (v > max_value) v <- max_value
  v
}

get_admission_file <- function(form_type) {
  form_type <- normalize_form_type(form_type)
  if (form_type == "02") return(FILE_02)
  return(FILE_01)
}


# ==========================================================
# 3. READ EXCEL DATA
# ==========================================================

read_admission_data <- function(file_path) {
  if (!file.exists(file_path)) {
    stop(paste("Admission file not found:", file_path))
  }

  if (grepl("\\.xlsx$", file_path, ignore.case = TRUE)) {
    rds_path <- sub("\\.xlsx$", ".rds", file_path, ignore.case = TRUE)
    if (file.exists(rds_path)) {
      cached <- readRDS(rds_path)
      if (is.list(cached) && !is.null(cached$admission_df) && !is.null(cached$rank_df)) {
        return(cached)
      }
    }
  }

  info <- file.info(file_path)
  cache_id <- paste0(basename(file_path), "_", as.numeric(info$mtime), "_", as.numeric(info$size))
  cache_id <- gsub("[^A-Za-z0-9_\\-\\.]", "_", cache_id)
  cache_file <- file.path(tempdir(), paste0("admission_cache_", cache_id, ".rds"))
  if (file.exists(cache_file)) {
    cached <- readRDS(cache_file)
    if (is.list(cached) && !is.null(cached$admission_df) && !is.null(cached$rank_df)) {
      return(cached)
    }
  }
  
  sheets <- excel_sheets(file_path)
  
  sheet_admission <- "\u6295\u6863\u8868"
  sheet_rank <- "\u4e00\u5206\u4e00\u6bb5"
  
  if (!(sheet_admission %in% sheets)) {
    stop(paste0("Sheet '", sheet_admission, "' not found"))
  }
  
  if (!(sheet_rank %in% sheets)) {
    stop(paste0("Sheet '", sheet_rank, "' not found"))
  }
  
  # 你的表结构：第一行是标题，第二行才是列名，因此 skip = 1
  admission_raw <- read_excel(file_path, sheet = sheet_admission, skip = 1)
  
  col_code <- "\u4ee3\u7801"
  col_major <- "\u4e13\u4e1a"
  col_school <- "\u9662\u6821"
  col_plan <- "\u6295\u6863\u8ba1\u5212\u6570"
  col_min_rank <- "\u6295\u6863\u6700\u4f4e\u4f4d\u6b21"
  col_min_score <- "\u6295\u6863\u6700\u4f4e\u5206\u6570"
  
  required_cols <- c(col_code, col_major, col_school, col_plan, col_min_rank, col_min_score)
  missing_cols <- setdiff(required_cols, names(admission_raw))
  if (length(missing_cols) > 0) {
    stop(
      paste(
        "Missing required columns in admission sheet:",
        paste(missing_cols, collapse = ", ")
      )
    )
  }
  
  rank_df <- read_excel(
    file_path,
    sheet = sheet_rank,
    col_names = c("score", "rank")
  )
  
  if (ncol(rank_df) < 2) {
    stop("Sheet '一分一段' must contain at least 2 columns")
  }
  
  admission_df <- admission_raw
  admission_df$code <- normalize_text(admission_raw[[col_code]])
  admission_df$major <- clean_major_name(admission_raw[[col_major]])
  admission_df$school <- normalize_text(admission_raw[[col_school]])
  admission_df$planCount <- safe_numeric(admission_raw[[col_plan]])
  admission_df$minRank <- safe_numeric(admission_raw[[col_min_rank]])
  admission_df$minScore <- safe_numeric(admission_raw[[col_min_score]])
  
  admission_df <- admission_df %>%
    transmute(
      code = code,
      school = school,
      major = major,
      planCount = planCount,
      minRank = minRank,
      minScore = minScore
    ) %>%
    filter(school != "", major != "")
  
  rank_df <- rank_df %>%
    mutate(
      score = safe_numeric(score),
      rank = safe_numeric(rank)
    ) %>%
    filter(!is.na(score), !is.na(rank)) %>%
    arrange(desc(score), rank)
  
  result <- list(admission_df = admission_df, rank_df = rank_df)
  tryCatch({
    saveRDS(result, cache_file)
  }, error = function(e) {
    NULL
  })
  result
}


# ==========================================================
# 4. SCORE / RANK CONVERSION
# ==========================================================

get_rank_from_score <- function(user_score, rank_df) {
  if (is.na(user_score) || nrow(rank_df) == 0) return(NA_real_)
  
  exact_row <- rank_df %>% filter(score == user_score)
  if (nrow(exact_row) > 0) {
    return(exact_row$rank[1])
  }
  
  lower_rows <- rank_df %>%
    filter(score <= user_score) %>%
    arrange(desc(score))
  
  if (nrow(lower_rows) > 0) {
    return(lower_rows$rank[1])
  }
  
  nearest_idx <- which.min(abs(rank_df$score - user_score))
  rank_df$rank[nearest_idx]
}

get_score_from_rank <- function(user_rank, rank_df) {
  if (is.na(user_rank) || nrow(rank_df) == 0) return(NA_real_)
  
  exact_row <- rank_df %>% filter(rank == user_rank)
  if (nrow(exact_row) > 0) {
    return(exact_row$score[1])
  }
  
  nearest_idx <- which.min(abs(rank_df$rank - user_rank))
  rank_df$score[nearest_idx]
}


# ==========================================================
# 5. MAJOR MATCHING
# ==========================================================

find_major_group <- function(text, groups) {
  text <- normalize_text(text)
  if (text == "") return(NA_character_)
  
  for (group_name in names(groups)) {
    keywords <- groups[[group_name]]
    hit <- any(sapply(keywords, function(k) str_detect(text, fixed(k))))
    if (hit) return(group_name)
  }
  
  return(NA_character_)
}

get_major_match_score <- function(user_preferences, target_major, groups = MAJOR_GROUPS) {
  target_major <- normalize_text(target_major)
  
  if (length(user_preferences) == 0 || all(user_preferences == "")) {
    return(0.0)
  }
  
  # 1) 强直接匹配
  for (pref in user_preferences) {
    if (pref == "") next
    if (str_detect(target_major, fixed(pref)) || str_detect(pref, fixed(target_major))) {
      return(1.0)
    }
  }
  
  # 2) 同专业组
  target_group <- find_major_group(target_major, groups)
  pref_groups <- sapply(user_preferences, find_major_group, groups = groups)
  
  if (!is.na(target_group) && any(pref_groups == target_group, na.rm = TRUE)) {
    return(0.8)
  }
  
  # 3) 部分关键词重合
  for (pref in user_preferences) {
    if (pref == "") next
    chunks <- unlist(str_extract_all(pref, "[[:alnum:]\u4e00-\u9fa5]{2,}"))
    if (length(chunks) == 0) next
    
    overlap <- any(sapply(chunks, function(ck) str_detect(target_major, fixed(ck))))
    if (overlap) return(0.5)
  }
  
  # 4) 默认弱匹配
  return(0.2)
}


# ==========================================================
# 6. RISK LABEL
# ==========================================================

get_risk_label <- function(score_gap, rank_gap) {
  if (!is.na(score_gap) && score_gap >= 8) return("保")
  if (!is.na(rank_gap) && rank_gap <= -5000) return("保")
  
  if (!is.na(score_gap) && score_gap >= 0) return("稳")
  if (!is.na(rank_gap) && rank_gap <= 0) return("稳")
  
  if (!is.na(score_gap) && score_gap >= -8) return("冲")
  if (!is.na(rank_gap) && rank_gap <= 10000) return("冲")
  
  return("风险较高")
}


# ==========================================================
# 7. INPUT PARSING
# ==========================================================

parse_input <- function(input) {
  get_field <- function(obj, key) {
    if (is.null(obj) || !is.list(obj)) return(NULL)
    if (is.null(names(obj))) return(NULL)
    if (!(key %in% names(obj))) return(NULL)
    obj[[key]]
  }
  
  raw_form_type <- get_field(input, "formType")
  raw_type <- get_field(input, "type")
  form_type <- if (!is.null(raw_form_type)) {
    normalize_form_type(raw_form_type)
  } else if (!is.null(raw_type)) {
    if (tolower(normalize_text(raw_type)) %in% c("02", "junior", "zhuanke", "专科")) "02" else "01"
  } else {
    "01"
  }
  
  raw_score <- get_field(input, "score")
  raw_rank <- get_field(input, "rank")
  scores_obj <- get_field(input, "scores")
  if (is.null(raw_score) && !is.null(scores_obj) && is.list(scores_obj)) {
    raw_score <- get_field(scores_obj, "totalScore")
  }
  if (is.null(raw_rank) && !is.null(scores_obj) && is.list(scores_obj)) {
    raw_rank <- get_field(scores_obj, "rank")
  }
  
  user_score <- if (!is.null(raw_score)) safe_numeric(raw_score) else NA_real_
  user_rank  <- if (!is.null(raw_rank)) safe_numeric(raw_rank) else NA_real_
  
  if (is.na(user_score) && is.na(user_rank)) {
    stop("Either score or rank is required")
  }
  
  major_preferences <- character(0)
  raw_major_prefs <- get_field(input, "majorPreferences")
  if (!is.null(raw_major_prefs)) {
    if (is.character(raw_major_prefs)) {
      major_preferences <- normalize_text(raw_major_prefs)
    } else if (is.list(raw_major_prefs)) {
      extracted <- unlist(lapply(raw_major_prefs, function(x) {
        if (is.list(x)) {
          v <- get_field(x, "majorName")
          if (!is.null(v)) return(v)
          return(x)
        }
        x
      }))
      major_preferences <- normalize_text(extracted)
    } else {
      major_preferences <- normalize_text(unlist(raw_major_prefs))
    }
  }
  major_preferences <- major_preferences[major_preferences != ""]
  
  raw_top_n <- get_field(input, "topN")
  top_n <- if (!is.null(raw_top_n)) validate_top_n(raw_top_n) else 20L
  
  list(
    form_type = form_type,
    user_score = user_score,
    user_rank = user_rank,
    major_preferences = major_preferences,
    top_n = top_n
  )
}


# ==========================================================
# 8. BUILD RESULT
# ==========================================================

build_result <- function(admission_df, rank_df, parsed_input) {
  form_type <- parsed_input$form_type
  user_score <- parsed_input$user_score
  user_rank <- parsed_input$user_rank
  major_preferences <- parsed_input$major_preferences
  top_n <- parsed_input$top_n
  
  if (is.na(user_rank) && !is.na(user_score)) {
    user_rank <- get_rank_from_score(user_score, rank_df)
  }
  
  if (is.na(user_score) && !is.na(user_rank)) {
    user_score <- get_score_from_rank(user_rank, rank_df)
  }

  candidate_df <- admission_df %>%
    transmute(
      code = code,
      school = school,
      major = major,
      planCount = planCount,
      minRank = minRank,
      minScore = minScore
    )

  if (!is.na(user_score)) {
    candidate_df <- candidate_df %>% filter(!is.na(minScore))
    low <- user_score - 30
    high <- user_score + 15
    candidate_df <- candidate_df %>% filter(minScore >= low & minScore <= high)
    if (nrow(candidate_df) > 20000) {
      low <- user_score - 20
      high <- user_score + 10
      candidate_df <- candidate_df %>% filter(minScore >= low & minScore <= high)
    }
  }

  if (!is.na(user_rank)) {
    candidate_df <- candidate_df %>% filter(!is.na(minRank))
    low_r <- user_rank - 15000
    high_r <- user_rank + 15000
    candidate_df <- candidate_df %>% filter(minRank >= low_r & minRank <= high_r)
    if (nrow(candidate_df) > 20000) {
      low_r <- user_rank - 12000
      high_r <- user_rank + 12000
      candidate_df <- candidate_df %>% filter(minRank >= low_r & minRank <= high_r)
    }
  }

  pre_n <- as.integer(max(top_n * 30, 600))
  if (pre_n > 3000) pre_n <- 3000L

  if (nrow(candidate_df) > pre_n) {
    seed_val <- as.integer((ifelse(is.na(user_score), 0, user_score) + ifelse(is.na(user_rank), 0, user_rank)) %% 100000)
    set.seed(seed_val)
    idx <- sample.int(nrow(candidate_df), pre_n)
    candidate_df <- candidate_df[idx, , drop = FALSE]
  }

  base_df <- candidate_df %>%
    mutate(
      userRank = user_rank,
      userScore = user_score,
      rankGap = ifelse(!is.na(user_rank) & !is.na(minRank), user_rank - minRank, NA_real_),
      scoreGap = ifelse(!is.na(user_score) & !is.na(minScore), user_score - minScore, NA_real_),
      baseScore = ifelse(is.na(scoreGap), 0, scoreGap * 0.5) +
                  ifelse(is.na(planCount), 0, log1p(planCount) * 1.5)
    )

  prefs <- normalize_text(major_preferences)
  prefs <- prefs[prefs != ""]
  if (length(prefs) == 0) {
    base_df$majorMatchScore <- 0
  } else {
    if (length(prefs) > 5) prefs <- prefs[1:5]
    match_vec <- rep(0.0, nrow(base_df))
    for (p in prefs) {
      if (!nzchar(p)) next
      match_vec <- pmax(match_vec, ifelse(grepl(p, base_df$major, fixed = TRUE), 1.0, 0.0))
    }
    base_df$majorMatchScore <- match_vec
  }

  riskLabel <- rep("风险较高", nrow(base_df))
  riskLabel <- ifelse(!is.na(base_df$scoreGap) & base_df$scoreGap >= -8, "冲", riskLabel)
  riskLabel <- ifelse(!is.na(base_df$rankGap) & base_df$rankGap <= 10000, "冲", riskLabel)
  riskLabel <- ifelse(!is.na(base_df$scoreGap) & base_df$scoreGap >= 0, "稳", riskLabel)
  riskLabel <- ifelse(!is.na(base_df$rankGap) & base_df$rankGap <= 0, "稳", riskLabel)
  riskLabel <- ifelse(!is.na(base_df$scoreGap) & base_df$scoreGap >= 8, "保", riskLabel)
  riskLabel <- ifelse(!is.na(base_df$rankGap) & base_df$rankGap <= -5000, "保", riskLabel)

  result_df <- base_df %>%
    mutate(
      recommendationScore = baseScore + majorMatchScore * 10,
      riskLabel = riskLabel
    ) %>%
    arrange(desc(recommendationScore)) %>%
    slice_head(n = top_n)
  
  items <- lapply(seq_len(nrow(result_df)), function(i) {
    row <- result_df[i, ]
    
    list(
      code = ifelse(is.na(row$code), NULL, as.character(row$code)),
      school = ifelse(is.na(row$school), NULL, as.character(row$school)),
      major = ifelse(is.na(row$major), NULL, as.character(row$major)),
      planCount = ifelse(is.na(row$planCount), NULL, as.numeric(row$planCount)),
      userRank = ifelse(is.na(row$userRank), NULL, as.numeric(row$userRank)),
      minRank = ifelse(is.na(row$minRank), NULL, as.numeric(row$minRank)),
      rankGap = ifelse(is.na(row$rankGap), NULL, as.numeric(row$rankGap)),
      userScore = ifelse(is.na(row$userScore), NULL, as.numeric(row$userScore)),
      minScore = ifelse(is.na(row$minScore), NULL, as.numeric(row$minScore)),
      scoreGap = ifelse(is.na(row$scoreGap), NULL, as.numeric(row$scoreGap)),
      majorMatchScore = ifelse(is.na(row$majorMatchScore), NULL, as.numeric(row$majorMatchScore)),
      recommendationScore = ifelse(is.na(row$recommendationScore), NULL, round(as.numeric(row$recommendationScore), 4)),
      riskLabel = ifelse(is.na(row$riskLabel), NULL, as.character(row$riskLabel))
    )
  })
  
  list(
    ok = TRUE,
    mode = "recommendation_scoring",
    formType = form_type,
    items = items
  )
}


# ==========================================================
# 9. MAIN
# ==========================================================

tryCatch({
  input_text <- ""
  if (!is.na(INPUT_PATH) && nzchar(INPUT_PATH) && file.exists(INPUT_PATH)) {
    input_lines <- readLines(INPUT_PATH, warn = FALSE, encoding = "UTF-8")
    input_text <- paste(input_lines, collapse = "\n")
  } else {
    stdin_con <- file("stdin")
    input_lines <- readLines(stdin_con, warn = FALSE, encoding = "UTF-8")
    close(stdin_con)
    input_text <- paste(input_lines, collapse = "\n")
  }
  
  if (nchar(trimws(input_text)) == 0) {
    stop("Empty stdin JSON input")
  }
  
  input <- fromJSON(input_text, simplifyVector = FALSE)
  parsed_input <- parse_input(input)
  
  admission_file <- get_admission_file(parsed_input$form_type)
  log_err("Using admission file:", admission_file)
  
  data_list <- read_admission_data(admission_file)
  
  result <- build_result(
    admission_df = data_list$admission_df,
    rank_df = data_list$rank_df,
    parsed_input = parsed_input
  )
  
  cat(
    toJSON(
      result,
      auto_unbox = TRUE,
      null = "null",
      na = "null"
    )
  )
  
}, error = function(e) {
  err <- list(
    ok = FALSE,
    error = "recommendation_failed",
    message = as.character(e$message)
  )
  
  cat(
    toJSON(
      err,
      auto_unbox = TRUE,
      null = "null",
      na = "null"
    )
  )
  
  quit(status = 1)
})
