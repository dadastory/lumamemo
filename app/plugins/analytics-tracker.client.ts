export default defineNuxtPlugin((_nuxtApp) => {
  const config = useRuntimeConfig()

  if (
    config.public.analytics.matomo?.enabled &&
    config.public.analytics.matomo.url &&
    config.public.analytics.matomo.siteId
  ) {
    let matomoBase: URL
    try {
      matomoBase = new URL(config.public.analytics.matomo.url)
    } catch {
      return
    }

    if (!['http:', 'https:'].includes(matomoBase.protocol)) {
      return
    }

    if (!matomoBase.pathname.endsWith('/')) {
      matomoBase.pathname = `${matomoBase.pathname}/`
    }

    const trackerUrl = new URL('matomo.php', matomoBase).toString()
    const scriptUrl = new URL('matomo.js', matomoBase).toString()
    const siteId = String(config.public.analytics.matomo.siteId)
    const paq = ((window as any)._paq = (window as any)._paq || [])
    paq.push(['trackPageView'])
    paq.push(['enableLinkTracking'])
    paq.push(['setTrackerUrl', trackerUrl])
    paq.push(['setSiteId', siteId])

    useHead({
      script: [
        {
          src: scriptUrl,
          async: true,
          tagPosition: 'head',
        },
      ],
    })
    return
  }
})
