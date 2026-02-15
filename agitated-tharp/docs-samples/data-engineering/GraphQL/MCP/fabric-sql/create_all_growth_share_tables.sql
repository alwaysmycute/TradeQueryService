-- ============================================================
-- 一次建立 5 張 growth/share 表
-- 來源：TXN_MOF_NON_PROTECT_MT + UNION_REF_HSCODE + UNION_REF_COUNTRY_AREA
-- 在 Fabric Notebook 中以 %%sql 執行（每個 CREATE TABLE 需各自一個 cell）
-- ============================================================

-- ============================================================
-- STEP 0: 建立基礎彙總暫存表（月度×國家×產業）
-- 所有 5 張表都從這張暫存表衍生
-- ============================================================

DROP TABLE IF EXISTS _base_monthly_by_countries;

CREATE TABLE _base_monthly_by_countries AS
SELECT
    DATE_TRUNC('MONTH', t.TXN_DT)       AS PERIOD_MONTH,
    YEAR(t.TXN_DT)                       AS YEAR,
    MONTH(t.TXN_DT)                      AS MONTH,
    t.TRADE_FLOW,
    COALESCE(h.Industry_ID, 0)           AS INDUSTRY_ID,
    COALESCE(h.Industry, '其他')          AS INDUSTRY,
    COALESCE(h.HS_Code_Group, '其他')     AS HS_CODE_GROUP,
    t.COUNTRY_ID,
    t.COUNTRY_COMM_ZH,
    COALESCE(a.AREA_ID, 'OTHER')         AS AREA_ID,
    COALESCE(a.AREA_NM, '其他')           AS AREA_NM,
    SUM(t.TRADE_VALUE_USD_AMT)           AS TRADE_VALUE_USD_AMT,
    SUM(t.TRADE_VALUE_TWD_AMT)           AS TRADE_VALUE_TWD_AMT,
    SUM(t.TRADE_WEIGHT)                  AS TRADE_WEIGHT,
    SUM(t.TRADE_QUANT)                   AS TRADE_QUANT,
    CASE WHEN SUM(t.TRADE_WEIGHT) = 0 THEN NULL
         ELSE SUM(t.TRADE_VALUE_USD_AMT) / SUM(t.TRADE_WEIGHT)
    END                                  AS UNIT_PRICE_USD_PER_KG,
    MAX(t.ETL_DT)                        AS ETL_DT
FROM IH_Syncbox.Trade_Data.dbo.TXN_MOF_NON_PROTECT_MT t
LEFT JOIN IH_Syncbox.Trade_Data.dbo.UNION_REF_HSCODE h
    ON t.HS_CODE = h.HS_Code
LEFT JOIN IH_Syncbox.Trade_Data.dbo.UNION_REF_COUNTRY_AREA a
    ON t.COUNTRY_COMM_ZH = a.COUNTRY_COMM_ZH
GROUP BY
    DATE_TRUNC('MONTH', t.TXN_DT),
    YEAR(t.TXN_DT),
    MONTH(t.TXN_DT),
    t.TRADE_FLOW,
    COALESCE(h.Industry_ID, 0),
    COALESCE(h.Industry, '其他'),
    COALESCE(h.HS_Code_Group, '其他'),
    t.COUNTRY_ID,
    t.COUNTRY_COMM_ZH,
    COALESCE(a.AREA_ID, 'OTHER'),
    COALESCE(a.AREA_NM, '其他');


-- ============================================================
-- STEP 0b: 建立基礎彙總暫存表（年度×國家×產業）
-- ============================================================

DROP TABLE IF EXISTS _base_yearly_by_countries;

CREATE TABLE _base_yearly_by_countries AS
SELECT
    YEAR,
    TRADE_FLOW,
    INDUSTRY_ID,
    INDUSTRY,
    HS_CODE_GROUP,
    COUNTRY_ID,
    COUNTRY_COMM_ZH,
    AREA_ID,
    AREA_NM,
    SUM(TRADE_VALUE_USD_AMT)            AS TRADE_VALUE_USD_AMT,
    SUM(TRADE_VALUE_TWD_AMT)            AS TRADE_VALUE_TWD_AMT,
    SUM(TRADE_WEIGHT)                   AS TRADE_WEIGHT,
    SUM(TRADE_QUANT)                    AS TRADE_QUANT,
    CASE WHEN SUM(TRADE_WEIGHT) = 0 THEN NULL
         ELSE SUM(TRADE_VALUE_USD_AMT) / SUM(TRADE_WEIGHT)
    END                                 AS UNIT_PRICE_USD_PER_KG,
    MAX(ETL_DT)                         AS ETL_DT
FROM _base_monthly_by_countries
GROUP BY
    YEAR, TRADE_FLOW, INDUSTRY_ID, INDUSTRY, HS_CODE_GROUP,
    COUNTRY_ID, COUNTRY_COMM_ZH, AREA_ID, AREA_NM;


-- ============================================================
-- STEP 0c: 月度總體（不含國家維度）
-- ============================================================

DROP TABLE IF EXISTS _base_monthly_totals;

CREATE TABLE _base_monthly_totals AS
SELECT
    PERIOD_MONTH, YEAR, MONTH, TRADE_FLOW,
    INDUSTRY_ID, INDUSTRY, HS_CODE_GROUP,
    SUM(TRADE_VALUE_USD_AMT)            AS TRADE_VALUE_USD_AMT,
    SUM(TRADE_WEIGHT)                   AS TRADE_WEIGHT,
    CASE WHEN SUM(TRADE_WEIGHT) = 0 THEN NULL
         ELSE SUM(TRADE_VALUE_USD_AMT) / SUM(TRADE_WEIGHT)
    END                                 AS UNIT_PRICE_USD_PER_KG,
    MAX(ETL_DT)                         AS ETL_DT
FROM _base_monthly_by_countries
GROUP BY
    PERIOD_MONTH, YEAR, MONTH, TRADE_FLOW,
    INDUSTRY_ID, INDUSTRY, HS_CODE_GROUP;


-- ============================================================
-- STEP 0d: 年度總體（不含國家維度）
-- ============================================================

DROP TABLE IF EXISTS _base_yearly_totals;

CREATE TABLE _base_yearly_totals AS
SELECT
    YEAR, TRADE_FLOW,
    INDUSTRY_ID, INDUSTRY,
    SUM(TRADE_VALUE_USD_AMT)            AS TRADE_VALUE_USD_AMT,
    SUM(TRADE_WEIGHT)                   AS TRADE_WEIGHT,
    CASE WHEN SUM(TRADE_WEIGHT) = 0 THEN NULL
         ELSE SUM(TRADE_VALUE_USD_AMT) / SUM(TRADE_WEIGHT)
    END                                 AS UNIT_PRICE_USD_PER_KG,
    MAX(ETL_DT)                         AS ETL_DT
FROM _base_yearly_by_countries
GROUP BY YEAR, TRADE_FLOW, INDUSTRY_ID, INDUSTRY;


-- ============================================================
-- TABLE 1/5: trade_yearly_growth_totals
-- 年度 YoY（金額/重量/單價）
-- ============================================================

DROP TABLE IF EXISTS trade_yearly_growth_totals;

CREATE TABLE trade_yearly_growth_totals AS
SELECT
    cur.YEAR,
    cur.TRADE_FLOW,
    cur.INDUSTRY_ID,
    cur.INDUSTRY,
    cur.TRADE_VALUE_USD_AMT,
    cur.TRADE_WEIGHT,
    cur.UNIT_PRICE_USD_PER_KG,

    prev.TRADE_VALUE_USD_AMT                                AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - prev.TRADE_VALUE_USD_AMT      AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN prev.TRADE_VALUE_USD_AMT IS NULL OR prev.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - prev.TRADE_VALUE_USD_AMT) / prev.TRADE_VALUE_USD_AMT
    END                                                     AS YOY_GROWTH_RATE_TRADE_VALUE_USD,

    prev.TRADE_WEIGHT                                       AS PREV_YEAR_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - prev.TRADE_WEIGHT                    AS YOY_DELTA_TRADE_WEIGHT,
    CASE WHEN prev.TRADE_WEIGHT IS NULL OR prev.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - prev.TRADE_WEIGHT) / prev.TRADE_WEIGHT
    END                                                     AS YOY_GROWTH_RATE_TRADE_WEIGHT,

    prev.UNIT_PRICE_USD_PER_KG                              AS PREV_YEAR_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - prev.UNIT_PRICE_USD_PER_KG  AS YOY_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN prev.UNIT_PRICE_USD_PER_KG IS NULL OR prev.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - prev.UNIT_PRICE_USD_PER_KG) / prev.UNIT_PRICE_USD_PER_KG
    END                                                     AS YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    cur.ETL_DT
FROM _base_yearly_totals cur
LEFT JOIN _base_yearly_totals prev
    ON  cur.TRADE_FLOW  = prev.TRADE_FLOW
    AND cur.INDUSTRY_ID = prev.INDUSTRY_ID
    AND cur.YEAR        = prev.YEAR + 1;


-- ============================================================
-- TABLE 2/5: trade_monthly_growth_totals
-- 月度 YoY + MoM（金額）
-- ============================================================

DROP TABLE IF EXISTS trade_monthly_growth_totals;

CREATE TABLE trade_monthly_growth_totals AS
SELECT
    cur.PERIOD_MONTH,
    cur.YEAR,
    cur.MONTH,
    cur.TRADE_FLOW,
    cur.TRADE_VALUE_USD_AMT,
    cur.TRADE_WEIGHT,
    cur.UNIT_PRICE_USD_PER_KG,

    yoy.TRADE_VALUE_USD_AMT                               AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT     AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN yoy.TRADE_VALUE_USD_AMT IS NULL OR yoy.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT) / yoy.TRADE_VALUE_USD_AMT
    END                                                   AS YOY_GROWTH_RATE_TRADE_VALUE_USD,

    mom.TRADE_VALUE_USD_AMT                               AS PREV_MONTH_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT     AS MOM_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN mom.TRADE_VALUE_USD_AMT IS NULL OR mom.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT) / mom.TRADE_VALUE_USD_AMT
    END                                                   AS MOM_GROWTH_RATE_TRADE_VALUE_USD,

    cur.ETL_DT,
    cur.INDUSTRY_ID,
    cur.INDUSTRY,
    cur.HS_CODE_GROUP

FROM _base_monthly_totals cur
LEFT JOIN _base_monthly_totals yoy
    ON  cur.TRADE_FLOW  = yoy.TRADE_FLOW
    AND cur.INDUSTRY_ID = yoy.INDUSTRY_ID
    AND cur.YEAR        = yoy.YEAR + 1
    AND cur.MONTH       = yoy.MONTH
LEFT JOIN _base_monthly_totals mom
    ON  cur.TRADE_FLOW  = mom.TRADE_FLOW
    AND cur.INDUSTRY_ID = mom.INDUSTRY_ID
    AND mom.YEAR        = CASE WHEN cur.MONTH = 1 THEN cur.YEAR - 1 ELSE cur.YEAR END
    AND mom.MONTH       = CASE WHEN cur.MONTH = 1 THEN 12 ELSE cur.MONTH - 1 END;


-- ============================================================
-- TABLE 3/5: trade_monthly_growth_by_countries
-- 各國月度 YoY + MoM（金額/重量/單價）
-- ============================================================

DROP TABLE IF EXISTS trade_monthly_growth_by_countries;

CREATE TABLE trade_monthly_growth_by_countries AS
SELECT
    cur.PERIOD_MONTH, cur.YEAR, cur.MONTH, cur.TRADE_FLOW,
    cur.INDUSTRY_ID, cur.INDUSTRY, cur.HS_CODE_GROUP,
    cur.COUNTRY_ID, cur.COUNTRY_COMM_ZH, cur.AREA_ID, cur.AREA_NM,
    cur.TRADE_VALUE_USD_AMT, cur.TRADE_WEIGHT, cur.UNIT_PRICE_USD_PER_KG,

    -- 金額 YoY
    yoy.TRADE_VALUE_USD_AMT  AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN yoy.TRADE_VALUE_USD_AMT IS NULL OR yoy.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - yoy.TRADE_VALUE_USD_AMT) / yoy.TRADE_VALUE_USD_AMT
    END AS YOY_GROWTH_RATE_TRADE_VALUE_USD,
    -- 重量 YoY
    yoy.TRADE_WEIGHT AS PREV_YEAR_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - yoy.TRADE_WEIGHT AS YOY_DELTA_TRADE_WEIGHT,
    CASE WHEN yoy.TRADE_WEIGHT IS NULL OR yoy.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - yoy.TRADE_WEIGHT) / yoy.TRADE_WEIGHT
    END AS YOY_GROWTH_RATE_TRADE_WEIGHT,
    -- 單價 YoY
    yoy.UNIT_PRICE_USD_PER_KG AS PREV_YEAR_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - yoy.UNIT_PRICE_USD_PER_KG AS YOY_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN yoy.UNIT_PRICE_USD_PER_KG IS NULL OR yoy.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - yoy.UNIT_PRICE_USD_PER_KG) / yoy.UNIT_PRICE_USD_PER_KG
    END AS YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    -- 金額 MoM
    mom.TRADE_VALUE_USD_AMT AS PREV_MONTH_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT AS MOM_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN mom.TRADE_VALUE_USD_AMT IS NULL OR mom.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - mom.TRADE_VALUE_USD_AMT) / mom.TRADE_VALUE_USD_AMT
    END AS MOM_GROWTH_RATE_TRADE_VALUE_USD,
    -- 重量 MoM
    mom.TRADE_WEIGHT AS PREV_MONTH_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - mom.TRADE_WEIGHT AS MOM_DELTA_TRADE_WEIGHT,
    CASE WHEN mom.TRADE_WEIGHT IS NULL OR mom.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - mom.TRADE_WEIGHT) / mom.TRADE_WEIGHT
    END AS MOM_GROWTH_RATE_TRADE_WEIGHT,
    -- 單價 MoM
    mom.UNIT_PRICE_USD_PER_KG AS PREV_MONTH_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - mom.UNIT_PRICE_USD_PER_KG AS MOM_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN mom.UNIT_PRICE_USD_PER_KG IS NULL OR mom.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - mom.UNIT_PRICE_USD_PER_KG) / mom.UNIT_PRICE_USD_PER_KG
    END AS MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    cur.ETL_DT

FROM _base_monthly_by_countries cur
LEFT JOIN _base_monthly_by_countries yoy
    ON  cur.TRADE_FLOW  = yoy.TRADE_FLOW
    AND cur.INDUSTRY_ID = yoy.INDUSTRY_ID
    AND cur.COUNTRY_ID  = yoy.COUNTRY_ID
    AND cur.YEAR        = yoy.YEAR + 1
    AND cur.MONTH       = yoy.MONTH
LEFT JOIN _base_monthly_by_countries mom
    ON  cur.TRADE_FLOW  = mom.TRADE_FLOW
    AND cur.INDUSTRY_ID = mom.INDUSTRY_ID
    AND cur.COUNTRY_ID  = mom.COUNTRY_ID
    AND mom.YEAR        = CASE WHEN cur.MONTH = 1 THEN cur.YEAR - 1 ELSE cur.YEAR END
    AND mom.MONTH       = CASE WHEN cur.MONTH = 1 THEN 12 ELSE cur.MONTH - 1 END;


-- ============================================================
-- TABLE 4/5: trade_monthly_share_by_countries
-- 各國月度市佔率
-- ============================================================

DROP TABLE IF EXISTS trade_monthly_share_by_countries;

CREATE TABLE trade_monthly_share_by_countries AS
WITH monthly_totals AS (
    SELECT YEAR, MONTH, TRADE_FLOW, INDUSTRY_ID,
           SUM(TRADE_VALUE_USD_AMT) AS TOTAL_TRADE_VALUE_USD_AMT,
           SUM(TRADE_WEIGHT)        AS TOTAL_TRADE_WEIGHT
    FROM _base_monthly_by_countries
    GROUP BY YEAR, MONTH, TRADE_FLOW, INDUSTRY_ID
)
SELECT
    c.PERIOD_MONTH, c.YEAR, c.MONTH, c.TRADE_FLOW,
    c.INDUSTRY_ID, c.INDUSTRY, c.HS_CODE_GROUP,
    c.COUNTRY_ID, c.COUNTRY_COMM_ZH, c.AREA_ID, c.AREA_NM,
    c.TRADE_VALUE_USD_AMT,
    t.TOTAL_TRADE_VALUE_USD_AMT,
    CASE WHEN t.TOTAL_TRADE_VALUE_USD_AMT IS NULL OR t.TOTAL_TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE c.TRADE_VALUE_USD_AMT / t.TOTAL_TRADE_VALUE_USD_AMT
    END AS SHARE_RATIO_TRADE_VALUE_USD,
    c.TRADE_WEIGHT,
    t.TOTAL_TRADE_WEIGHT,
    CASE WHEN t.TOTAL_TRADE_WEIGHT IS NULL OR t.TOTAL_TRADE_WEIGHT = 0 THEN NULL
         ELSE c.TRADE_WEIGHT / t.TOTAL_TRADE_WEIGHT
    END AS SHARE_RATIO_TRADE_WEIGHT,
    c.UNIT_PRICE_USD_PER_KG,
    c.ETL_DT
FROM _base_monthly_by_countries c
INNER JOIN monthly_totals t
    ON  c.YEAR        = t.YEAR
    AND c.MONTH       = t.MONTH
    AND c.TRADE_FLOW  = t.TRADE_FLOW
    AND c.INDUSTRY_ID = t.INDUSTRY_ID;


-- ============================================================
-- TABLE 5/5: trade_yearly_share_by_countries
-- 各國年度市佔率
-- ============================================================

DROP TABLE IF EXISTS trade_yearly_share_by_countries;

CREATE TABLE trade_yearly_share_by_countries AS
WITH yearly_totals AS (
    SELECT YEAR, TRADE_FLOW, INDUSTRY_ID,
           SUM(TRADE_VALUE_USD_AMT) AS TOTAL_TRADE_VALUE_USD_AMT,
           SUM(TRADE_WEIGHT)        AS TOTAL_TRADE_WEIGHT
    FROM _base_yearly_by_countries
    GROUP BY YEAR, TRADE_FLOW, INDUSTRY_ID
)
SELECT
    c.YEAR, c.TRADE_FLOW,
    c.COUNTRY_ID, c.COUNTRY_COMM_ZH, c.AREA_ID, c.AREA_NM,
    c.TRADE_VALUE_USD_AMT,
    t.TOTAL_TRADE_VALUE_USD_AMT,
    CASE WHEN t.TOTAL_TRADE_VALUE_USD_AMT IS NULL OR t.TOTAL_TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE c.TRADE_VALUE_USD_AMT / t.TOTAL_TRADE_VALUE_USD_AMT
    END AS SHARE_RATIO_TRADE_VALUE_USD,
    c.TRADE_WEIGHT,
    t.TOTAL_TRADE_WEIGHT,
    CASE WHEN t.TOTAL_TRADE_WEIGHT IS NULL OR t.TOTAL_TRADE_WEIGHT = 0 THEN NULL
         ELSE c.TRADE_WEIGHT / t.TOTAL_TRADE_WEIGHT
    END AS SHARE_RATIO_TRADE_WEIGHT,
    c.UNIT_PRICE_USD_PER_KG,
    c.ETL_DT,
    c.INDUSTRY_ID, c.INDUSTRY, c.HS_CODE_GROUP
FROM _base_yearly_by_countries c
INNER JOIN yearly_totals t
    ON  c.YEAR        = t.YEAR
    AND c.TRADE_FLOW  = t.TRADE_FLOW
    AND c.INDUSTRY_ID = t.INDUSTRY_ID;


-- ============================================================
-- 清理暫存表（選擇性，如果不想留可取消註解）
-- ============================================================
-- DROP TABLE IF EXISTS _base_monthly_by_countries;
-- DROP TABLE IF EXISTS _base_yearly_by_countries;
-- DROP TABLE IF EXISTS _base_monthly_totals;
-- DROP TABLE IF EXISTS _base_yearly_totals;
