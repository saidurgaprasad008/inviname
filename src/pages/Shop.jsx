// src/pages/Shop.jsx — all products with search, filters and sorting.
// Every filter is kept in the address (e.g. /shop?category=earrings&sort=price-asc) so links can be shared.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCatalog } from '../data/catalog.js'
import { waLink } from '../config/site.js'
import usePageTitle from '../lib/usePageTitle.js'
import ProductCard, { ProductCardSkeleton } from '../components/shop/ProductCard.jsx'
import Filters from '../components/shop/Filters.jsx'
import CategoryStrip from '../components/shop/CategoryStrip.jsx'
import { IconSearch, IconFilter, IconClose, IconWhatsApp } from '../components/Icons.jsx'

const SORTS = [
  ['popular', 'Popular'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['newest', 'Newest'],
]
const list = (v) => (v ? v.split(',').filter(Boolean) : [])
const isSize = (name) => /inch|^\d+(\.\d+)?$/i.test(name)

export default function Shop() {
  const cat = useCatalog()
  const [sp, setSp] = useSearchParams()
  const [sheet, setSheet] = useState(false)
  const searchRef = useRef(null)

  // ---- current filters, read from the address ----
  const f = {
    category: list(sp.get('category')),
    size: list(sp.get('size')),
    colour: list(sp.get('colour')),
    min: Number(sp.get('min')) || 0,
    max: Number(sp.get('max')) || 0,
    type: sp.get('type') || '',
    stock: sp.get('stock') === '1',
    sort: sp.get('sort') || 'popular',
    q: sp.get('q') || '',
  }
  function update(patch) {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.join(',') : v === true ? '1' : v
      if (!val || val === 'popular') next.delete(k)
      else next.set(k, String(val))
    }
    next.delete('focus')
    setSp(next, { replace: true })
  }
  const clearAll = () => setSp(new URLSearchParams(f.q ? { q: f.q } : {}), { replace: true })

  // ---- search box (updates the address shortly after typing stops) ----
  const [q, setQ] = useState(f.q)
  useEffect(() => setQ(f.q), [f.q])
  useEffect(() => {
    if (q === f.q) return
    const t = setTimeout(() => update({ q: q.trim() }), 300)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sp.get('focus') === 'search') searchRef.current?.focus()
  }, [sp])

  // close the phone filter sheet with Escape, and stop the page scrolling under it
  useEffect(() => {
    if (!sheet) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && setSheet(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [sheet])

  const oneCat = f.category.length === 1 ? cat?.catBySlug[f.category[0]] : null
  usePageTitle(oneCat ? oneCat.name : 'Shop')

  // ---- filter options + results ----
  const { results, options, priceCap } = useMemo(() => {
    if (!cat) return { results: [], options: { sizes: [], colours: [] }, priceCap: 2500 }
    const pool = f.category.length ? cat.products.filter((p) => f.category.includes(p.category)) : cat.products
    const sizes = [...new Set(pool.flatMap((p) => p.variants.map((v) => v.name)).filter(isSize))].sort((a, b) => parseFloat(a) - parseFloat(b))
    const colours = [...new Set(pool.flatMap((p) => p.colours))].sort()
    const priceCap = Math.ceil(Math.max(...cat.products.map((p) => p.maxPrice)) / 100) * 100
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    const hi = f.max || Infinity
    let r = pool.filter(
      (p) =>
        p.variants.some((v) => v.price >= f.min && v.price <= hi) &&
        (!f.size.length || p.variants.some((v) => f.size.includes(v.name))) &&
        (!f.colour.length || p.colours.some((c) => f.colour.includes(c))) &&
        (!f.type || p.type === f.type) &&
        (!f.stock || p.available) &&
        words.every((w) => `${p.name} ${p.description} ${p.categoryName}`.toLowerCase().includes(w)),
    )
    const by = {
      popular: (a, b) => b.featured - a.featured || b.available - a.available || b.createdAt.localeCompare(a.createdAt),
      'price-asc': (a, b) => a.minPrice - b.minPrice,
      'price-desc': (a, b) => b.minPrice - a.minPrice,
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    }
    r = [...r].sort(by[f.sort] || by.popular)
    return { results: r, options: { sizes, colours }, priceCap }
  }, [cat, sp]) // eslint-disable-line react-hooks/exhaustive-deps

  // chips for the filters that are on
  const chips = [
    ...f.category.map((s) => [cat?.catBySlug[s]?.name || s, () => update({ category: f.category.filter((x) => x !== s) })]),
    ...(f.min || f.max ? [[`₹${f.min} – ${f.max ? '₹' + f.max : 'any'}`, () => update({ min: 0, max: 0 })]] : []),
    ...f.size.map((s) => [s, () => update({ size: f.size.filter((x) => x !== s) })]),
    ...f.colour.map((s) => [s, () => update({ colour: f.colour.filter((x) => x !== s) })]),
    ...(f.type ? [[f.type === 'custom' ? 'Made to order' : 'Ready-made', () => update({ type: '' })]] : []),
    ...(f.stock ? [['In stock', () => update({ stock: false })]] : []),
  ]
  const activeCount = chips.length

  const filterPanel = cat && <Filters f={f} update={update} categories={cat.categories} options={options} priceCap={priceCap} />
  const sortSelect = (
    <label className="relative">
      <span className="sr-only">Sort by</span>
      <select value={f.sort} onChange={(e) => update({ sort: e.target.value })} className="select">
        {SORTS.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="pb-10">
      {/* header */}
      <section className="shop-hero border-b border-plum-line">
        <div className="container-page pb-6 pt-8 sm:pb-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link to="/" className="hover:text-gold">Home</Link> <span className="mx-1.5">/</span>
            {oneCat ? <><Link to="/shop" className="hover:text-gold">Shop</Link> <span className="mx-1.5">/</span> <span className="text-cream">{oneCat.name}</span></> : <span className="text-cream">Shop</span>}
          </nav>
          <h1 className="mt-3 text-4xl sm:text-5xl">{oneCat ? oneCat.name : 'Shop all resin art'}</h1>
          <p className="mt-2 text-sm text-muted sm:text-base">{oneCat ? oneCat.line : 'Real flowers, gold flakes and your memories, handmade in Andhra Pradesh.'}</p>
          <div className="mt-7">
            {cat ? (
              <CategoryStrip categories={cat.categories} active={f.category.length === 1 ? f.category[0] : f.category.length ? 'multi' : ''} to={(slug) => (slug ? `/shop?category=${slug}` : '/shop')} />
            ) : (
              <div className="skeleton h-24 rounded-2xl" />
            )}
          </div>
        </div>
      </section>

      {/* toolbar: search, filters (phones), sort */}
      <div className="shop-toolbar sticky top-[72px] z-30 border-b border-plum-line bg-plum/90 backdrop-blur-md">
        <div className="container-page flex items-center gap-2 py-3 sm:gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search products</span>
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search keychains, lockets, clocks…"
              className="field w-full pl-11"
              enterKeyHint="search"
            />
          </label>
          <button type="button" onClick={() => setSheet(true)} className="btn-filter lg:hidden" aria-haspopup="dialog">
            <IconFilter className="h-5 w-5" />
            <span className="hidden min-[400px]:inline">Filters</span>
            {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-semibold text-plum">{activeCount}</span>}
          </button>
          <div className="hidden sm:block">{sortSelect}</div>
        </div>
      </div>

      <div className="container-page mt-6 grid gap-8 lg:grid-cols-[15.5rem_1fr]">
        {/* filters (laptops) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[150px] max-h-[calc(100svh-170px)] overflow-y-auto pr-2 no-scrollbar">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-sm font-medium uppercase tracking-[0.2em] text-cream">Filters</h2>
              {activeCount > 0 && <button type="button" onClick={clearAll} className="text-xs text-gold hover:underline">Clear all</button>}
            </div>
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-muted" aria-live="polite">
              {cat ? `${results.length} ${results.length === 1 ? 'piece' : 'pieces'}` : 'Loading…'}
              {f.q && <> for “<span className="text-cream">{f.q}</span>”</>}
            </p>
            <div className="sm:hidden">{sortSelect}</div>
          </div>
          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {chips.map(([label, remove]) => (
                <button key={label} type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 py-1 pl-3 pr-2 text-xs text-gold hover:bg-gold/20">
                  {label} <IconClose className="h-3.5 w-3.5" aria-label="remove" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="px-2 text-xs text-muted underline hover:text-gold">Clear all</button>
            </div>
          )}

          {!cat ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => <li key={i}><ProductCardSkeleton /></li>)}
            </ul>
          ) : results.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((p, i) => (
                <li key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
                  <ProductCard p={p} eager={i < 4} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card mx-auto max-w-lg px-6 py-12 text-center">
              {typeof navigator !== 'undefined' && navigator.onLine === false ? (
                <>
                  <h2 className="text-3xl">You are offline</h2>
                  <p className="mt-2 text-muted">Connect to the internet to see our pieces, then reopen the app.</p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl">No pieces match</h2>
                  <p className="mt-2 text-muted">Try removing a filter, or tell us what you have in mind and we will make it for you.</p>
                </>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={clearAll} className="btn-ghost">Clear filters</button>
                <a href={waLink('Hi Inviname Arts, I am looking for a custom piece.')} target="_blank" rel="noopener noreferrer" className="btn-rose">
                  <IconWhatsApp className="h-4 w-4" /> Ask on WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* filters (phones): bottom sheet */}
      <div className={`fixed inset-0 z-[70] lg:hidden ${sheet ? '' : 'pointer-events-none'}`} aria-hidden={!sheet}>
        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${sheet ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSheet(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          inert={!sheet}
          className={`absolute inset-x-0 bottom-0 flex max-h-[86svh] flex-col rounded-t-[1.75rem] border-t border-gold/25 bg-plum-card shadow-[0_-20px_60px_rgb(0_0_0_/_0.6)] transition-transform duration-300 ease-out ${sheet ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-blush/25" aria-hidden="true" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <h2 className="font-sans text-base font-medium text-cream">Filters</h2>
            <button type="button" onClick={() => setSheet(false)} className="grid h-10 w-10 place-items-center rounded-full text-cream" aria-label="Close filters">
              <IconClose />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{filterPanel}</div>
          <div className="flex gap-3 border-t border-plum-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={clearAll} className="btn-ghost flex-1">Clear</button>
            <button type="button" onClick={() => setSheet(false)} className="btn-rose flex-[2]">Show {results.length} {results.length === 1 ? 'piece' : 'pieces'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
