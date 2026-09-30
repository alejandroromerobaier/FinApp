import { getAnalytics, isSupported, logEvent, setUserId, Analytics } from 'firebase/analytics';
import { app } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

let analyticsPromise: Promise<Analytics | null> | null = null;

export const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (typeof window === 'undefined') return null;

  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) => {
      if (supported) {
        try {
          const analytics = getAnalytics(app);
          return analytics;
        } catch (e) {
          console.warn('[Analytics] Error initializing Firebase Analytics:', e);
          return null;
        }
      } else {
        console.info('[Analytics] Firebase Analytics is not supported in this environment.');
        return null;
      }
    }).catch(err => {
      console.warn('[Analytics] Error checking Analytics support:', err);
      return null;
    });
  }

  return analyticsPromise;
};

/**
 * Tracks a page view event in Google Analytics.
 */
export const trackPageView = async (path: string, title?: string) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_path: path,
        page_title: title || document.title,
      });
    }
  } catch (err) {
    console.warn('[Analytics] Error tracking page view:', err);
  }
};

/**
 * Tracks a custom event in Google Analytics.
 */
export const trackEvent = async (eventName: string, eventParams?: Record<string, any>) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  } catch (err) {
    console.warn('[Analytics] Error tracking event:', err);
  }
};

/**
 * Sets the authenticated user ID for Google Analytics tracking.
 */
export const setAnalyticsUser = async (userId: string | null) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics && userId) {
      setUserId(analytics, userId);
    }
  } catch (err) {
    console.warn('[Analytics] Error setting user ID:', err);
  }
};
