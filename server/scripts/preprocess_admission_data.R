suppressPackageStartupMessages(library(readxl))
suppressPackageStartupMessages(library(dplyr))

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: preprocess_admission_data.R <input_xlsx> <output_rds>")
}

input_xlsx <- args[[1]]
output_rds <- args[[2]]

normalize_text <- function(x) {
  if (is.null(x)) return("")
  y <- as.character(x)
  y[is.na(y)] <- ""
  y <- gsub("\\s+", " ", y, perl = TRUE)
  trimws(y)
}

safe_numeric <- function(x) {
  if (is.null(x)) return(NA_real_)
  if (is.numeric(x)) return(as.numeric(x))
  y <- normalize_text(x)
  y[y == ""] <- NA_character_
  suppressWarnings(as.numeric(y))
}

clean_major_name <- function(x) {
  y <- normalize_text(x)
  y <- sub("^[A-Za-z0-9]+", "", y)
  trimws(y)
}

if (!file.exists(input_xlsx)) stop(paste("File not found:", input_xlsx))

sheet_admission <- "\u6295\u6863\u8868"
sheet_rank <- "\u4e00\u5206\u4e00\u6bb5"

sheets <- excel_sheets(input_xlsx)
if (!(sheet_admission %in% sheets)) stop(paste0("Sheet '", sheet_admission, "' not found"))
if (!(sheet_rank %in% sheets)) stop(paste0("Sheet '", sheet_rank, "' not found"))

admission_raw <- read_excel(input_xlsx, sheet = sheet_admission, skip = 1)

col_code <- "\u4ee3\u7801"
col_major <- "\u4e13\u4e1a"
col_school <- "\u9662\u6821"
col_plan <- "\u6295\u6863\u8ba1\u5212\u6570"
col_min_rank <- "\u6295\u6863\u6700\u4f4e\u4f4d\u6b21"
col_min_score <- "\u6295\u6863\u6700\u4f4e\u5206\u6570"

required_cols <- c(col_code, col_major, col_school, col_plan, col_min_rank, col_min_score)
missing_cols <- setdiff(required_cols, names(admission_raw))
if (length(missing_cols) > 0) {
  stop(paste("Missing required columns:", paste(missing_cols, collapse = ", ")))
}

admission_df <- tibble(
  code = normalize_text(admission_raw[[col_code]]),
  school = normalize_text(admission_raw[[col_school]]),
  major = clean_major_name(admission_raw[[col_major]]),
  planCount = safe_numeric(admission_raw[[col_plan]]),
  minRank = safe_numeric(admission_raw[[col_min_rank]]),
  minScore = safe_numeric(admission_raw[[col_min_score]])
) %>% filter(school != "", major != "")

rank_df <- read_excel(input_xlsx, sheet = sheet_rank, col_names = c("score", "rank"))
rank_df <- rank_df %>%
  transmute(score = safe_numeric(score), rank = safe_numeric(rank)) %>%
  filter(!is.na(score), !is.na(rank)) %>%
  arrange(desc(score), rank)

dir.create(dirname(output_rds), recursive = TRUE, showWarnings = FALSE)
saveRDS(list(admission_df = admission_df, rank_df = rank_df), output_rds)
