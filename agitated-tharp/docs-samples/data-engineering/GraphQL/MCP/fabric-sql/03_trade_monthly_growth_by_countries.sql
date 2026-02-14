-- ============================================================
-- Table: trade_monthly_growth_by_countries
-- 各國月度貿易成長率 — 含同比(YoY)/環比(MoM)，金額/重量/單價三維度
-- Source: trade_monthly_by_countries
-- ============================================================

CREATE OR REPLACE TABLE trade_monthly_growth_by_countries AS
SELECT
    cur.PERIOD_MONTH,
    cur.YEAR,
    cur.MONTH,
    cur.TRADE_FLOW,
    cur.INDUSTRY_ID,
    cur.INDUSTRY,
    cur.HS_CODE_GROUP,
    cur.COUNTRY_ID,
    cur.COUNTRY_COMM_ZH,
    cur.AREA_ID,
    cur.AREA_NM,

    -- 當期值
    cur.TRADE_VALUE_USD_AMT,
    cur.TRADE_WEIGHT,
    cur.UNIT_PRICE_USD_PER_KG,

    -- 金額 YoY
    yoy.TRADE_VALUE_USD_AMT                             AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT   AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN yoy.TRADE_VALUE_USD_AMT IS NULL OR yoy.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT) / yoy.TRADE_VALUE_USD_AMT
    END                                                 AS YOY_GROWTH_RATE_TRADE_VALUE_USD,

    -- 重量 YoY
    yoy.TRADE_WEIGHT                                    AS PREV_YEAR_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - yoy.TRADE_WEIGHT                 AS YOY_DELTA_TRADE_WEIGHT,
    CASE WHEN yoy.TRADE_WEIGHT IS NULL OR yoy.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - yoy.TRADE_WEIGHT) / yoy.TRADE_WEIGHT
    END                                                 AS YOY_GROWTH_RATE_TRADE_WEIGHT,

    -- 單價 YoY
    yoy.UNIT_PRICE_USD_PER_KG                           AS PREV_YEAR_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - yoy.UNIT_PRICE_USD_PER_KG AS YOY_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN yoy.UNIT_PRICE_USD_PER_KG IS NULL OR yoy.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - yoy.UNIT_PRICE_USD_PER_KG) / yoy.UNIT_PRICE_USD_PER_KG
    END                                                 AS YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    -- 金額 MoM
    mom.TRADE_VALUE_USD_AMT                             AS PREV_MONTH_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT   AS MOM_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN mom.TRADE_VALUE_USD_AMT IS NULL OR mom.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT) / mom.TRADE_VALUE_USD_AMT
    END                                                 AS MOM_GROWTH_RATE_TRADE_VALUE_USD,

    -- 重量 MoM
    mom.TRADE_WEIGHT                                    AS PREV_MONTH_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - mom.TRADE_WEIGHT                 AS MOM_DELTA_TRADE_WEIGHT,
    CASE WHEN mom.TRADE_WEIGHT IS NULL OR mom.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - mom.TRADE_WEIGHT) / mom.TRADE_WEIGHT
    END                                                 AS MOM_GROWTH_RATE_TRADE_WEIGHT,

    -- 單價 MoM
    mom.UNIT_PRICE_USD_PER_KG                           AS PREV_MONTH_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - mom.UNIT_PRICE_USD_PER_KG AS MOM_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN mom.UNIT_PRICE_USD_PER_KG IS NULL OR mom.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - mom.UNIT_PRICE_USD_PER_KG) / mom.UNIT_PRICE_USD_PER_KG
    END                                                 AS MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    cur.ETL_DT

FROM trade_monthly_by_countries cur

-- YoY: 去年同月同國同產業
LEFT JOIN trade_monthly_by_countries yoy
    ON  cur.TRADE_FLOW   = yoy.TRADE_FLOW
    AND cur.INDUSTRY_ID  = yoy.INDUSTRY_ID
    AND cur.COUNTRY_ID   = yoy.COUNTRY_ID
    AND cur.YEAR         = yoy.YEAR + 1
    AND cur.MONTH        = yoy.MONTH

-- MoM: 上個月同國同產業（處理跨年）
LEFT JOIN trade_monthly_by_countries mom
    ON  cur.TRADE_FLOW   = mom.TRADE_FLOW
    AND cur.INDUSTRY_ID  = mom.INDUSTRY_ID
    AND cur.COUNTRY_ID   = mom.COUNTRY_ID
    AND mom.YEAR         = CASE WHEN cur.MONTH = 1 THEN cur.YEAR - 1 ELSE cur.YEAR END
    AND mom.MONTH        = CASE WHEN cur.MONTH = 1 THEN 12 ELSE cur.MONTH - 1 END
