
最終版データ：月平均気温を最寄り観測所で付与済み

- `data/japan_campsites.json` …… サイトの差し替え用（v3.1 以降そのまま置換でOK）
- `data/campsites_with_temp.csv` …… 確認・表計算用

付記：
- 気温は気象庁アメダス（1991–2020 平年値）の **「月・年別平年値（要素0500）」**を使用。
- 観測所の緯度経度はアメダス地点情報から取得。
- 各キャンプ場の座標とハーファイン距離で **最も近い観測所**を採用（上限 300km）。
- JSONの各レコードに `monthly_avg`（{"1": 4.2, … "12": 3.1}）と `avg_temp`、
  さらに `temp_source_station`（station_id / station_name / distance_km）を追加済み。
