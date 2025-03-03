import { ISeriesApi } from "lightweight-charts";

declare module "lightweight-charts" {
  interface IChartApi {
    addCandlestickSeries(options?: any): ISeriesApi<"Candlestick">;
  }
}