export interface AppVersionInfo {
  version: string;
  commit: string;
  buildDate: string;
  formattedDate: string;
  env: 'PROD' | 'QA' | 'DEV' | string;
  isProd: boolean;
  isQA: boolean;
  isDev: boolean;
}

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.7.0';
export const COMMIT_HASH: string = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
export const APP_ENV: string = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : 'DEV';

export const formatBuildDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

export const getAppVersionInfo = (): AppVersionInfo => {
  const env = (APP_ENV || 'PROD').toUpperCase();
  return {
    version: APP_VERSION,
    commit: COMMIT_HASH,
    buildDate: BUILD_DATE,
    formattedDate: formatBuildDate(BUILD_DATE),
    env,
    isProd: env === 'PROD' || env === 'PRODUCTION',
    isQA: env === 'QA',
    isDev: env === 'DEV' || env === 'DEVELOPMENT',
  };
};
