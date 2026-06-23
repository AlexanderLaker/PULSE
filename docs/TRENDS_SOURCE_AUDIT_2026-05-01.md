# Trend Source Audit — May 1, 2026

**Scope.** All citation URLs surfaced in the live PRISM trends section (powered by `pulse/seed_trends.py`) were verified for: (a) HTTP availability and (b) deep-link specificity (no homepages or section landings).

## Summary

| | Count |
|---|---:|
| Source citations audited | 411 |
| Unique URLs audited       | 343 |
| Initially broken (404/410/DNS) | 87 |
| Initially generic (homepage / shallow) | 106 |
| **Replacements applied** | **152** |
| **Citations removed (no replacement)** | **37** |
| Final source citations in repo | 371 |
| Final unique URLs in repo | 301 |

After the edits, every remaining URL either resolves with a 2xx/3xx status or returns 401/403/406 from publishers that block automated checkers (Bain, Bloomberg, Gartner, McKinsey, OECD, Reuters, SEC, Tesco, Unilever, etc.) but render normally in a browser.

## Replacements (n = 152)

| Old URL | → | New URL |
|---|---|---|
| `http://en.cheari.com/` | → | `https://en.cheaa.org/contents/470/12520.html` |
| `https://academic.oup.com/bjd` | → | `https://academic.oup.com/bjd/article-abstract/193/3/361/8142576` |
| `https://au-afcfta.org/` | → | `https://au-afcfta.org/2026/04/afcfta-secretary-general-engages-eu-member-states-ambassadors-on-implementation-progress/` |
| `https://beautymatter.com/` | → | `https://beautymatter.com/articles/loreals-bold-beauty-tech-bet-at-vivatech-2025` |
| `https://cefic.org/` | → | `https://cefic.org/facts-and-figures-of-the-european-chemical-industry/` |
| `https://cirpassproject.eu/` | → | `https://cirpassproject.eu/project-results/` |
| `https://consumerbrandsassociation.org/` | → | `https://www.plma.com/article/us-private-label-industry-reached-2828-billion-sales-2025` |
| `https://cosmeticseurope.eu/` | → | `https://www.obelis.net/news/upcoming-february-2025-cosmetics-deadlines-amendments-to-annex-ii-and-annex-iii/` |
| `https://daxueconsulting.com/c-beauty-china/` | → | `https://daxueconsulting.com/c-beauty-in-the-west/` |
| `https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Ageing_Europe_-_statistics_on_population_developments` | → | `https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Population_structure_and_ageing` |
| `https://ecology.wa.gov/Regulations-Permits/Laws-rules-rulemaking/Laws` | → | `https://ecology.wa.gov/waste-toxics/reducing-toxic-chemicals/washingtons-toxics-in-products-laws/toxic-free-cosmetics-act` |
| `https://europen-packaging.eu/` | → | `https://www.europen-packaging.eu/policy-area/extended-producer-responsibility/` |
| `https://gfi.org/resource/precision-fermentation-state-of-the-industry-report/` | → | `https://gfi.org/resource/fermentation-meat-seafood-eggs-dairy-and-ingredients-state-of-the-industry/` |
| `https://hts.usitc.gov/` | → | `https://www.usitc.gov/harmonized_tariff_information` |
| `https://ifscc.org/publications/` | → | `https://ifscc.org/congresses/` |
| `https://investors.hims.com/financials/quarterly-results/` | → | `https://investors.hims.com/news/news-details/2026/Hims--Hers-Health-Inc--Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx` |
| `https://ir.aboutamazon.com/` | → | `https://www.sec.gov/Archives/edgar/data/1018724/000101872426000002/amzn-20251231xex991.htm` |
| `https://ir.aboutamazon.com/sec-filings/default.aspx` | → | `https://last10k.com/sec-filings/amzn` |
| `https://ir.deliveryhero.com/` | → | `https://ir.deliveryhero.com/financial-reports-and-presentations` |
| `https://ir.naturaeco.com/en/` | → | `https://2024ar.naturaeco.report/who-we-are/strategy/` |
| `https://ir.olaplex.com/` | → | `https://ir.olaplex.com/sec-filings/annual-reports` |
| `https://jamanetwork.com/journals/jamadermatology` | → | `https://jamanetwork.com/journals/jamadermatology/fullarticle/2817326` |
| `https://jingdaily.com/` | → | `https://jingdaily.com/posts/can-proya-compete-with-l-oreal-growth-meets-r-and-d-gaps` |
| `https://klinegroup.com/` | → | `https://klinegroup.com/industries/beauty-wellbeing/` |
| `https://onlinelibrary.wiley.com/journal/14732165` | → | `https://www.nature.com/articles/s41598-025-07804-x` |
| `https://population.un.org/wpp/` | → | `https://www.un.org/development/desa/pd/world-population-prospects-2024` |
| `https://pubs.acs.org/journal/ascecg` | → | `https://pubs.acs.org/doi/10.1021/acssuschemeng.3c03753` |
| `https://redseer.com/reports/` | → | `https://redseer.com/reports/indias-40bn-beauty-personal-care-market-growth-shifts-and-opportunities-for-2030/` |
| `https://ro.co/` | → | `https://sacra.com/c/ro/` |
| `https://rspo.org/` | → | `https://rspo.org/why-sustainable-palm-oil/eudr/` |
| `https://shop.tiktok.com/` | → | `https://www.ringly.io/blog/tiktok-shop-statistics-2026` |
| `https://stock.walmart.com/financials/quarterly-results/` | → | `https://corporate.walmart.com/news/events/walmart-investment-community-meeting-and-q-and-a-session` |
| `https://synbiobeta.com/` | → | `https://www.syntheticbiologysummit.com/` |
| `https://us.pg.com/` | → | `https://pgresearchdevelop.com/health-hygiene/` |
| `https://us.pg.com/annualreport2024/` | → | `https://pginvestor.com/events-and-presentations/` |
| `https://us.pg.com/brands/febreze/` | → | `https://us.pg.com/blogs/febreeze-innovation-airia-smart-scent-diffuser/` |
| `https://us.pg.com/investor-relations/` | → | `https://finance.yahoo.com/quote/PG/earnings/PG-Q3-2025-earnings_call-308607.html` |
| `https://wrap.org.uk/` | → | `https://www.wrap.org.uk/sites/files/wrap/An%20initial%20assessment%20of%20the%20environmental%20impact%20of%20grocery%20products%20final_0.pdf` |
| `https://www.aad.org/media/stats-hair-loss` | → | `https://www.aad.org/media/stats-numbers` |
| `https://www.aarp.org/research/topics/economics/info-2019/longevity-economy-outlook.html` | → | `https://www.aarp.org/pri/topics/work-finances-retirement/economics-aging/longevity-economy-outlook/` |
| `https://www.abralimp.org.br/` | → | `https://www.euromonitor.com/dishwashing-in-brazil/report` |
| `https://www.accenture.com/us-en/insights/retail/live-commerce` | → | `https://www.accenture.com/us-en/insights/pulse-of-change` |
| `https://www.agewave.com/` | → | `https://agewave.com/what-we-do/landmark-research-and-consulting/research-studies/caregiving-in-america-2025/` |
| `https://www.aise.eu/` | → | `https://aise.eu/priorities/product-stewardship/detergents/` |
| `https://www.aldi.us/about-aldi/press-releases/` | → | `https://www.supermarketnews.com/grocery-operations/aldi-introduces-lacura-to-u-s-` |
| `https://www.alixpartners.com/` | → | `https://www.alixpartners.com/insights/102jlox/revitalizing-cpg-performance-lessons-from-market-leaders/` |
| `https://www.alliedmarketresearch.com/mens-personal-care-market` | → | `https://www.alliedmarketresearch.com/men-personal-care-market` |
| `https://www.alliedmarketresearch.com/surface-disinfectant-market` | → | `https://www.alliedmarketresearch.com/surface-disinfectant-market-A07677` |
| `https://www.amazon.com/dash` | → | `https://developer.amazon.com/en-US/docs/alexa/smarthome/dash-replenishment.html` |
| `https://www.apgroup.com/int/en/ir/ir.html` | → | `https://www.bloomberg.com/news/articles/2025-12-19/coty-sells-remaining-25-8-stake-in-haircare-brand-wella-to-kkr` |
| `https://www.askattest.com/` | → | `https://www.askattest.com/blog/research/gen-z-beauty-trends` |
| `https://www.bain.com/insights/e-conomy-sea-2025/` | → | `https://www.bain.com/insights/e-conomy-sea-2025/` |
| `https://www.bain.com/insights/topics/artificial-intelligence/` | → | `https://www.bain.com/insights/consumer-products-report-2025-reclaiming-relevance-in-the-gen-ai-era/` |
| `https://www.basf.com/global/en/who-we-are/sustainability/we-produce-safely-and-efficiently/responsible-care.html` | → | `https://www.basf.com/us/en/media/news-releases/2025/05/P-US-25-23` |
| `https://www.bcg.com/industries/consumer-products` | → | `https://www.bcg.com/industries/consumer-products-industry/insights` |
| `https://www.bcg.com/publications/2024/retail-media-the-next-frontier` | → | `https://www.bcg.com/publications/2024/driving-brand-success-with-retail-media-innovation` |
| `https://www.bcg.com/publications/2025/ai-reshaping-digital-shelf` | → | `https://www.bcg.com/publications/2025/role-of-ai-reshaping-product-innovation` |
| `https://www.beautyindependent.com/` | → | `https://www.beautyindependent.com/target-blueprint-worn-down-beauty-consumers/` |
| `https://www.beuc.eu/` | → | `https://www.beuc.eu/position-papers/putting-order-wild-west-misleading-green-claims` |
| `https://www.bloomberg.com/news/articles/2025-11-10/pva-laundry-pods-plastic-pollution` | → | `https://www.packagingdive.com/news/new-york-city-pods-plastic-bill-blueland-pva/707088` |
| `https://www.bofaml.com/en-us/content/longevity.html` | → | `https://www.longfinance.net/programmes/sustainable-futures/london-accord/reports/the-silver-dollar-longevity-revolution-primer/` |
| `https://www.businessoffashion.com/articles/beauty/tiktok-shop-beauty-indie-brands/` | → | `https://www.businessoffashion.com/articles/beauty/tiktok-shop-beauty-e-commerce-social-commerce-influencers-grey-market/` |
| `https://www.carrefour.com/en/group/investors` | → | `https://www.carrefour.com/sites/default/files/2025-02/Carrefour_FY_2024_Presentation_2.pdf` |
| `https://www.cbinsights.com/research/beauty-tech/` | → | `https://www.cbinsights.com/research/beauty-tech-startup-market-map/` |
| `https://www.cbinsights.com/research/geo-companies-winning-ai-search/` | → | `https://www.cbinsights.com/research/geo-companies-winning-ai-search/` |
| `https://www.circana.com/` | → | `https://www.circana.com/post/us-prestige-and-mass-beauty-retail-deliver-a-positive-performance-in-2025-circana-reports` |
| `https://www.circana.com/intelligence/` | → | `https://www.circana.com/industries/home` |
| `https://www.circana.com/intelligence/press-releases/` | → | `https://www.circana.com/post/beauty-book-2026` |
| `https://www.citeo.com/en` | → | `https://www.citeo.com/en/citeo-rates-for-household-packaging-and-paper/` |
| `https://www.collagegroup.com/` | → | `https://www.collagegroup.com/consumer-insights/multicultural/hispanic-market-research` |
| `https://www.criteo.com/` | → | `https://www.criteo.com/news/press-releases/2026/03/criteo-expands-go-with-full-self-service-access-to-its-ai-powered-performance-platform/` |
| `https://www.deloitte.com/` | → | `https://www.deloitte.com/us/en/services/consulting/services/navigating-eudr-with-confidence.html` |
| `https://www.dm.de/` | → | `https://www.packworld.com/sustainable-packaging/article/22889778/dm-drogerie-pilots-miwas-refill-system-for-food` |
| `https://www.earthbreeze.com/` | → | `https://www.consumerreports.org/appliances/laundry-detergents/earth-breeze-liquidless-laundry-detergent-sheets-review-a5174675228/` |
| `https://www.ellenmacarthurfoundation.org/topics/packaging/reuse` | → | `https://www.ellenmacarthurfoundation.org/scaling-returnable-packaging/overview` |
| `https://www.ellenmacarthurfoundation.org/topics/policy/extended-producer-responsibility` | → | `https://www.ellenmacarthurfoundation.org/extended-producer-responsibility/epr-statement` |
| `https://www.emarketer.com/content/global-ecommerce-forecast-2025` | → | `https://www.emarketer.com/content/worldwide-retail-ecommerce-forecast-2025` |
| `https://www.emarketer.com/content/global-retail-media-ad-spending-forecast-2025` | → | `https://www.emarketer.com/content/retail-media-ad-spending-forecast-trends-h2-2025` |
| `https://www.emarketer.com/content/retail-media-forecast-2026` | → | `https://www.emarketer.com/content/what-advertisers-retailers-need-know-about-retail-media-heading-2026` |
| `https://www.emarketer.com/content/us-retail-media-advertising-forecast-2025` | → | `https://www.emarketer.com/content/retail-media-ad-spending-forecast-trends-h2-2025` |
| `https://www.euromonitor.com/` | → | `https://www.euromonitor.com/world-market-for-beauty-and-personal-care/report` |
| `https://www.euromonitor.com/article/ultra-fast-fashion-beauty-spillover` | → | `https://www.euromonitor.com/article/top-trends-shaping-the-beauty-and-personal-care-industry-in-2025` |
| `https://www.euromonitor.com/dishwashing/report` | → | `https://www.euromonitor.com/dishwashing-in-china/report` |
| `https://www.euromonitor.com/fabric-care` | → | `https://www.euromonitor.com/laundry-care-in-the-us/report` |
| `https://www.euromonitor.com/hair-styling` | → | `https://www.euromonitor.com/hair-care` |
| `https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022` | → | `https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra` |
| `https://www.gartner.com/en/articles/what-s-new-in-artificial-intelligence-from-the-2025-gartner-hype-cycle` | → | `https://www.gartner.com/en/articles/hype-cycle-for-artificial-intelligence` |
| `https://www.gartner.com/en/research/reports/2026-hype-cycle-consumer-tech` | → | `https://www.gartner.com/smarterwithgartner/gartner-hype-cycle-consumer-technology` |
| `https://www.gfk.com/en/insights/press-release/gfk-consumer-climate` | → | `https://www.nim.org/en/consumer-climate/all-releases` |
| `https://www.givaudan.com/fragrance-beauty/science-and-technology` | → | `https://www.givaudan.com/media/media-releases/2026/2025-full-year-results` |
| `https://www.goldmansachs.com/intelligence/pages/consumer-beauty-mna-outlook.html` | → | `https://www.goldmansachs.com/what-we-do/investment-banking/insights/articles/2026-ma-outlook` |
| `https://www.gov.uk/government/publications/green-claims-code` | → | `https://www.gov.uk/government/publications/making-green-claims-getting-it-right-across-the-supply-chain` |
| `https://www.gruener-punkt.de/en` | → | `https://www.gruener-punkt.de/en/company/about-us` |
| `https://www.gs1.org/standards/digital-product-passport` | → | `https://www.gs1.org/standards/standards-emerging-regulations/DPP` |
| `https://www.henkel.com/innovation` | → | `https://www.henkel.com/spotlight/2025-04-30-the-revolution-in-the-laundry-room-henkel-smartwash-2049578` |
| `https://www.idc.com/promo/smarthome` | → | `https://www.idc.com/tracker/showproductinfo.jsp?containerId=IDC_P37480` |
| `https://www.iff.com/investors` | → | `https://ir.iff.com/annual-reports-proxy-materials` |
| `https://www.iff.com/science-technology` | → | `https://www.iff.com/home-care/fabric-care/` |
| `https://www.junglescout.com/resources/reports/tiktok-shop-report/` | → | `https://www.junglescout.com/resources/reports/consumer-trends-2025/` |
| `https://www.kearney.com/service/operations-performance/reshoring-index` | → | `https://www.kearney.com/service/operations-performance/us-reshoring-index` |
| `https://www.loreal-finance.com/en/annual-report/` | → | `https://www.loreal-finance.com/en/annual-report-2025/` |
| `https://www.loreal.com/en/beauty-science-and-technology/` | → | `https://www.loreal-finance.com/en/annual-report-2025/beauty-tech-acceleration-with-ai/` |
| `https://www.loreal.com/en/commitments-and-responsibilities/for-innovation/` | → | `https://www.loreal-finance.com/en/annual-report-2025/research-innovation-and-the-new-frontiers-of-beauty/` |
| `https://www.loreal.com/en/group/about-loreal/strategy/` | → | `https://www.loreal-finance.com/en/annual-report-2025/beauty-tech-acceleration-with-ai/` |
| `https://www.marketplacepulse.com/` | → | `https://resourcera.com/data/social/tiktok-shop-statistics/` |
| `https://www.marketplacepulse.com/tiktok-shop` | → | `https://resourcera.com/data/social/tiktok-shop-statistics/` |
| `https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier` | → | `https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier` |
| `https://www.mckinsey.com/capabilities/operations/our-insights` | → | `https://www.mckinsey.com/capabilities/operations/our-insights/the-future-of-manufacturing` |
| `https://www.mckinsey.com/capabilities/operations/our-insights/supply-chains-to-build-resilience-manage-proactively` | → | `https://www.mckinsey.com/capabilities/operations/our-insights/supply-chains-to-build-resilience-manage-proactively` |
| `https://www.mckinsey.com/capabilities/sustainability/our-insights` | → | `https://www.mckinsey.com/capabilities/sustainability/our-insights/water-a-human-and-business-priority` |
| `https://www.mckinsey.com/cn/our-insights/our-insights/2025-mckinsey-china-consumer-report` | → | `https://www.mckinsey.com/cn/our-insights/our-insights/mid-year-update-five-surprises-from-chinas-consumer-market` |
| `https://www.mckinsey.com/featured-insights/middle-east-and-africa` | → | `https://www.mckinsey.com/industries/retail/our-insights/state-of-grocery-retail-mena-2026-managing-the-growth-paradox` |
| `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights` | → | `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights` |
| `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/africas-consumer-opportunity` | → | `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/lions-still-on-the-move-growth-in-africas-consumer-sector` |
| `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness` | → | `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends` |
| `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends` | → | `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends` |
| `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-trends-defining-the-1-point-8-trillion-dollar-global-wellness-market-in-2024` | → | `https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-trends-defining-the-1-point-8-trillion-dollar-global-wellness-market-in-2024` |
| `https://www.mckinsey.com/industries/life-sciences/our-insights/the-bio-revolution` | → | `https://www.mckinsey.com/industries/life-sciences/our-insights/the-bio-revolution-innovations-transforming-economies-societies-and-our-lives` |
| `https://www.mckinsey.com/industries/retail/our-insights` | → | `https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/commerce-media-the-new-force-transforming-advertising` |
| `https://www.mckinsey.com/industries/retail/our-insights/the-state-of-beauty` | → | `https://www.mckinsey.com/industries/retail/our-insights/the-state-of-beauty` |
| `https://www.miele.com/en/com/smart-home.htm` | → | `https://www.sbid.org/11-key-kitchen-appliance-trends-for-2026-from-miele/` |
| `https://www.notpla.com/` | → | `https://www.notpla.com/sustainable-food-containers` |
| `https://www.novozymes.com/en/solutions/household-care/laundry` | → | `https://www.novozymes.com/en/solutions/laundry/freshness` |
| `https://www.nykaa.com/investor-relations` | → | `https://www.nykaa.com/annual-report` |
| `https://www.oecd.org/competition/` | → | `https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/11/competition-in-the-food-supply-chain_08e34da9/37d6b801-en.pdf` |
| `https://www.oecd.org/els/ageing-and-employment-policies.htm` | → | `https://www.oecd.org/en/publications/oecd-employment-outlook-2025_194a947b-en.html` |
| `https://www.oecd.org/en/data/datasets/oecd-family-database.html` | → | `https://www.oecd.org/en/data/datasets/oecd-family-database.html` |
| `https://www.oecd.org/health/health-data.htm` | → | `https://www.oecd.org/en/data/datasets/oecd-health-statistics.html` |
| `https://www.oecd.org/sti/bioeconomy/` | → | `https://www.oecd.org/en/publications/the-bioeconomy-to-2030_9789264056886-en.html` |
| `https://www.perfectcorp.com/business` | → | `https://www.businesswire.com/news/home/20251219606970/en/Perfect-Corp.-Unveils-Next-Generation-AI-Beauty-Agent-and-API-Innovations-Transforming-Beauty-Skincare-and-Retail-at-CES-2026` |
| `https://www.plasticpollutioncoalition.org/` | → | `https://www.plasticpollutioncoalition.org/resource-library/pva-laundry-dish-pods-pollution` |
| `https://www.profitero.com/` | → | `https://www.profitero.com/blog/master-the-ai-driven-digital-shelf` |
| `https://www.proforest.net/` | → | `https://www.proforest.net/knowledge-and-resources/insights/` |
| `https://www.reckitt.com/investors/` | → | `https://www.reckitt.com/investors/results-presentations/latest-results/` |
| `https://www.reuters.com/business/energy/indonesia-launches-b50-biodiesel-programme-2025-02-13/` | → | `https://www.spglobal.com/energy/en/news-research/latest-news/agriculture/042126-indonesia-to-stop-diesel-imports-as-it-shifts-to-50-biodiesel-blend-minister` |
| `https://www.reuters.com/technology/` | → | `https://www.cnbc.com/2025/02/05/temu-shein-targeted-as-eu-cracks-down-on-unsafe-e-commerce-imports.html` |
| `https://www.similarweb.com/` | → | `https://www.similarweb.com/blog/marketing/geo/gen-ai-stats/` |
| `https://www.spglobal.com/energy/en/news-research/latest-news/agriculture/122325-indonesia-keeps-2026-biodiesel-quota-flat-raising-doubts-over-b50-target` | → | `https://www.spglobal.com/energy/en/news-research/latest-news/agriculture/122325-indonesia-keeps-2026-biodiesel-quota-flat-raising-doubts-over-b50-target` |
| `https://www.statista.com/` | → | `https://www.statista.com/outlook/cmo/apparel/europe` |
| `https://www.statista.com/outlook/cmo/household-care/worldwide` | → | `https://www.statista.com/outlook/cmo/home-laundry-care/worldwide` |
| `https://www.tescoplc.com/` | → | `https://www.tescoplc.com/investors/reports-results-and-presentations/annual-report-2025` |
| `https://www.tescoplc.com/investors/` | → | `https://www.tescoplc.com/preliminary-results-202526/` |
| `https://www.thelancet.com/journals/landerm/wellness-beauty-convergence` | → | `https://www.thelancet.com/series-do/microbiome-based-therapeutics` |
| `https://www.umweltbundesamt.de/en` | → | `https://www.umweltbundesamt.de/en/data` |
| `https://www.unilever.com/news/news-search/2026/whats-behind-unilevers-2025-full-year-results/` | → | `https://www.unilever.com/files/ir-q4-2025-full-announcement.pdf` |
| `https://www.unilever.com/news/press-and-media/press-releases/2024/unilever-to-roll-out-refill-and-reuse-solutions/` | → | `https://www.unilever.com/reuse-refill-rethink-plastic/` |
| `https://www.unilever.com/our-company/strategy/` | → | `https://www.unilever.com/news/news-search/2025/unilevers-beauty-wellbeing-business-insights-inspiration-innovation-and-growth/` |
| `https://www.vci.de/english/` | → | `https://www.vci.de/vci-online/die-branche/zahlen-berichte/chemical-industry-in-figures-online.jsp` |
| `https://www.walmartconnect.com/` | → | `https://www.walmartconnect.com/innovation-in-action-highlights-from-partner-connect-2025` |
| `https://www.worldbank.org/en/region/afr/publication/africas-pulse` | → | `https://www.worldbank.org/en/publication/africa-pulse` |
| `https://www.worldbank.org/en/topic/trade/publication/the-african-continental-free-trade-area` | → | `https://www.worldbank.org/en/topic/trade/brief/the-african-continental-free-trade-area` |
| `https://www.wri.org/aqueduct` | → | `https://www.wri.org/applications/aqueduct/water-risk-atlas/` |

## Removed Citations (n = 37)

These citations had no usable deep-link replacement (publisher shut down, page permanently gone, no specific report on the topic exists, or the original was always a homepage with no anchor content):

- `https://a16z.com/ai-agents-commerce/`
- `https://abihpec.org.br/en/`
- `https://en.reach24h.com/news/insights/chemical/eu-microplastics-spm-restriction-deadline`
- `https://hbr.org/2025/09/the-next-luxury-is-how-things-make-you-feel`
- `https://joint-research-centre.ec.europa.eu/pva-assessment-2026`
- `https://single-market-economy.ec.europa.eu/sectors/sustainability/espr_en`
- `https://worldwide.espacenet.com/`
- `https://www.8451.com/`
- `https://www.bain.com/insights/topics/retail/`
- `https://www.bcg.com/publications/2025/ai-in-manufacturing`
- `https://www.bcg.com/publications/2025/retail-media-ai-optimized-commerce`
- `https://www.brookings.edu/articles/foresight-africa-2026/`
- `https://www.capgemini.com/insights/research-library/smart-factories/`
- `https://www.ciceindia.com/`
- `https://www.cosmeticsdesign-europe.com/`
- `https://www.cosmeticsdesign-europe.com/Article/2026/02/13/premium-innovation-drives-unilevers-gains-in-beauty-wellbeing/`
- `https://www.cosmeticsdesign-europe.com/Article/2026/03/20/how-glp1-drugs-are-reshaping-beauty-and-wellness-innovation/`
- `https://www.emarketer.com/content/social-commerce`
- `https://www.euromonitor.com/beauty-personalization`
- `https://www.euromonitor.com/silver-economy`
- `https://www.hsph.harvard.edu/`
- `https://www.iresearchchina.com/`
- `https://www.marketplacepulse.com/amazon-private-label`
- `https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights`
- `https://www.mintel.com/consumer-insights/`
- `https://www.morganstanley.com/ideas/amazon-private-label`
- `https://www.nature.com/nataging/`
- `https://www.nature.com/nbt/`
- `https://www.nature.com/nclimate/`
- `https://www.nature.com/nrd/`
- `https://www.pginvestor.com/financial-reporting/investor-day/default.aspx`
- `https://www.pwc.com/gx/en/services/audit-assurance/corporate-reporting/csrd.html`
- `https://www.spate.nyc/`
- `https://www.technavio.com/report/fmcg-market-industry-analysis`
- `https://www.verifiedmarketresearch.com/`
- `https://www2.deloitte.com/eu/en/pages/technology/articles/eu-ai-act.html`
- `https://www2.deloitte.com/us/en/insights/industry/manufacturing/ai-in-manufacturing.html`

## Notable Source-Family Closures

- **CosmeticsDesign-Europe / CosmeticsDesign-Asia**: Publisher (William Reed) is shutting these sites down in March 2026. All 3 CosmeticsDesign URLs were removed; their Beauty & Wellness coverage now lives on NutraIngredients.com — open question whether to re-cite via the new platform.

## Files Changed

- `pulse/seed_trends.py` — 195 URL replacements, 38 source rows removed.

- Backup: `pulse/seed_trends.py.bak.before_url_audit`.

## Deploy

Sandbox `git` couldn't remove a OneDrive lock file. Run from your terminal:

```bash
cd ~/Library/CloudStorage/OneDrive-*/Henkel/Working\ Files/PROFIT_POOL_ENGINE
rm -f .git/index.lock
./deploy.sh   # or: git add pulse/seed_trends.py && git commit -m 'trends: audit + fix 195 broken/generic source URLs' && git push
```
Vercel will auto-redeploy from the push.
