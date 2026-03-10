const runtimeConfig = (
  window as Window & {
    __APP_CONFIG__?: {
      MAPBOX_ACCESS_TOKEN?: string;
    };
  }
).__APP_CONFIG__;

export const accessToken: string = runtimeConfig?.MAPBOX_ACCESS_TOKEN ?? "";
