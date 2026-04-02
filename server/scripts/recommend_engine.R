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

validate_top_n <- function(x, default_value = 20L, max_value = 100L) {
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
  
  sheets <- excel_sheets(file_path)
  
  if (!("投档表" %in% sheets)) {
    stop("Sheet '投档表' not found")
  }
  
  if (!("一分一段" %in% sheets)) {
    stop("Sheet '一分一段' not found")
  }
  
  # 你的表结构：第一行是标题，第二行才是列名，因此 skip = 1
  admission_df <- read_excel(file_path, sheet = "投档表", skip = 1)
  
  required_cols <- c("代码", "专业", "院校", "投档计划数", "投档最低位次", "投档最低分数")
  missing_cols <- setdiff(required_cols, names(admission_df))
  if (length(missing_cols) > 0) {
    stop(
      paste(
        "Missing required columns in 投档表:",
        paste(missing_cols, collapse = ", ")
      )
    )
  }
  
  rank_df <- read_excel(
    file_path,
    sheet = "一分一段",
    col_names = c("score", "rank")
  )
  
  if (ncol(rank_df) < 2) {
    stop("Sheet '一分一段' must contain at least 2 columns")
  }
  
  admission_df <- admission_df %>%
    mutate(
      代码 = normalize_text(代码),
      专业_raw = normalize_text(专业),
      专业 = clean_major_name(专业),
      院校 = normalize_text(院校),
      投档计划数 = safe_numeric(投档计划数),
      投档最低位次 = safe_numeric(投档最低位次),
      投档最低分数 = safe_numeric(投档最低分数)
    ) %>%
    filter(院校 != "", 专业 != "")
  
  rank_df <- rank_df %>%
    mutate(
      score = safe_numeric(score),
      rank = safe_numeric(rank)
    ) %>%
    filter(!is.na(score), !is.na(rank)) %>%
    arrange(desc(score), rank)
  
  list(
    admission_df = admission_df,
    rank_df = rank_df
  )
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
  form_type <- if (!is.null(input$formType)) normalize_form_type(input$formType) else "01"
  
  user_score <- if (!is.null(input$score)) safe_numeric(input$score) else NA_real_
  user_rank  <- if (!is.null(input$rank)) safe_numeric(input$rank) else NA_real_
  
  if (is.na(user_score) && is.na(user_rank)) {
    stop("Either score or rank is required")
  }
  
  major_preferences <- character(0)
  if (!is.null(input$majorPreferences)) {
    if (is.character(input$majorPreferences)) {
      major_preferences <- normalize_text(input$majorPreferences)
    } else {
      major_preferences <- normalize_text(unlist(input$majorPreferences))
    }
  }
  
  top_n <- if (!is.null(input$topN)) validate_top_n(input$topN) else 20L
  
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
  
  result_df <- admission_df %>%
    transmute(
      code = 代码,
      school = 院校,
      major = 专业,
      planCount = 投档计划数,
      minRank = 投档最低位次,
      minScore = 投档最低分数
    ) %>%
    mutate(
      userRank = user_rank,
      userScore = user_score,
      
      rankGap = ifelse(
        !is.na(user_rank) & !is.na(minRank),
        user_rank - minRank,
        NA_real_
      ),
      
      scoreGap = ifelse(
        !is.na(user_score) & !is.na(minScore),
        user_score - minScore,
        NA_real_
      ),
      
      majorMatchScore = sapply(major, function(m) {
        get_major_match_score(major_preferences, m)
      })
    ) %>%
    mutate(
      recommendationScore =
        ifelse(is.na(scoreGap), 0, scoreGap * 0.35) +
        ifelse(is.na(rankGap), 0, -rankGap / 1000 * 0.35) +
        majorMatchScore * 20 +
        ifelse(is.na(planCount), 0, log1p(planCount) * 2),
      
      riskLabel = mapply(get_risk_label, scoreGap, rankGap)
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
