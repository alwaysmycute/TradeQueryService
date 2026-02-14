-- ============================================================
-- Table: trade_monthly_growth_totals
-- 月度貿易成長率（總體）— 含同比(YoY)/環比(MoM)，金額維度
-- Source: trade_monthly_totals
-- ============================================================

CREATE OR REPLACE TABLE trade_monthly_growth_totals AS
SELECT
    cur.PERIOD_MONTH,
    cur.YEAR,
    cur.MONTH,
    cur.TRADE_FLOW,
    cur.INDUSTRY_ID,
    cur.INDUSTRY,
    cur.HS_CODE_GROUP,

    -- 當期值
    cur.TRADE_VALUE_USD_AMT,
    cur.TRADE_WEIGHT,
    cur.UNIT_PRICE_USD_PER_KG,

    -- 金額 YoY（同比：與去年同月比）
    yoy.TRADE_VALUE_USD_AMT                             AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT   AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN yoy.TRADE_VALUE_USD_AMT IS NULL OR yoy.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT) / yoy.TRADE_VALUE_USD_AMT
    END                                                 AS YOY_GROWTH_RATE_TRADE_VALUE_USD,

    -- 金額 MoM（環比：與上月比）
    mom.TRADE_VALUE_USD_AMT                             AS PREV_MONTH_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT   AS MOM_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN mom.TRADE_VALUE_USD_AMT IS NULL OR mom.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT) / mom.TRADE_VALUE_USD_AMT
    END                                                 AS MOM_GROWTH_RATE_TRADE_VALUE_USD,

    cur.ETL_DT

FROM trade_monthly_totals cur

-- YoY: 去年同月
LEFT JOIN trade_monthly_totals yoy
    ON  cur.TRADE_FLOW   = yoy.TRADE_FLOW
    AND cur.INDUSTRY_ID  = yoy.INDUSTRY_ID
    AND cur.YEAR         = yoy.YEAR + 1
    AND cur.MONTH        = yoy.MONTH

-- MoM: 上個月（處理跨年：1月的上月是去年12月）
LEFT JOIN trade_monthly_totals mom
    ON  cur.TRADE_FLOW   = mom.TRADE_FLOW
    AND cur.INDUSTRY_ID  = mom.INDUSTRY_ID
    AND mom.YEAR         = CASE WHEN cur.MONTH = 1 THEN cur.YEAR - 1 ELSE cur.YEAR END
    AND mom.MONTH        = CASE WHEN cur.MONTH = 1 THEN 12 ELSE cur.MONTH - 1 END
