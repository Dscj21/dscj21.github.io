// Ad hooks. IDs live in ads.json. Web: banner slot stays hidden. Native Capacitor: AdMob banner above the tab bar.
const Ads = (() => {
  let cfg = null, admob = null, bannerShown = false, suspended = false;
  const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  async function init() {
    try { cfg = await (await fetch('ads.json')).json(); } catch { cfg = { enabled: false }; }
    if (!cfg.enabled || !native()) return;
    admob = window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
    if (!admob || !cfg.android || !cfg.android.bannerId) return;
    try {
      await admob.initialize({ initializeForTesting: !!cfg.android.testing, testingDevices: cfg.android.testingDevices || [] });
      try { admob.addListener('bannerAdSizeChanged', s => { if (s && s.height) document.documentElement.style.setProperty('--adh', s.height + 'px'); }); } catch (e) {}
      await admob.showBanner({ adId: cfg.android.bannerId, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 62, isTesting: !!cfg.android.testing });
      document.documentElement.classList.add('has-native-banner');
      document.documentElement.style.setProperty('--adh', '50px');
      const bar = document.getElementById('adbar');
      if (bar) { bar.hidden = false; bar.setAttribute('aria-hidden', 'false'); }
      bannerShown = true;
    } catch (e) { console.warn('admob', e); }
  }
  function suspend() {
    if (suspended) return;
    suspended = true;
    if (admob && bannerShown) try { admob.hideBanner().catch(() => {}); } catch (e) {}
  }
  function resume() {
    if (!suspended) return;
    suspended = false;
    if (admob && bannerShown) try { admob.resumeBanner().catch(() => {}); } catch (e) {}
  }
  return { init, suspend, resume };
})();
document.addEventListener('DOMContentLoaded', () => Ads.init());
