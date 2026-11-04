// src/pages/Checkout.jsx — delivery details + order summary → place order → payment page (/order/INV-…).
// Login is required (see App.jsx). The address is remembered on this device for next time.
import { useEffect, useState } from 'react'
import { usePinPlace } from '../data/pincode.js'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../data/auth.js'
import { useCheckout } from '../data/checkout.js'
import { clearCart, cartCount } from '../data/cart.js'
import { placeOrder } from '../data/orders.js'
import { formatINR, img } from '../data/catalog.js'
import usePageTitle from '../lib/usePageTitle.js'
import ArtImage from '../components/home/ArtImage.jsx'
import { PaySplit, CustomSummary } from './Cart.jsx'
import { IconShield, IconArrow } from '../components/Icons.jsx'

const ADDR_KEY = 'inv-address'
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem(ADDR_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function Checkout() {
  usePageTitle('Checkout')
  const { user } = useAuth()
  const c = useCheckout()
  const pickup = c.method === 'pickup'
  const [f, setF] = useState(() => ({ name: user?.name || '', phone: '', address: '', landmark: '', city: '', ...saved(), pincode: c.pin }))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const place = usePinPlace(f.pincode)
  // fill the village automatically when the pincode has only one village / area
  useEffect(() => {
    if (place && place.areas.length === 1) setF((o) => (o.city.trim() ? o : { ...o, city: `${place.areas[0]}, ${place.district}` }))
  }, [place])
  const [placed, setPlaced] = useState('')
  const set = (k) => (e) => {
    const v = k === 'phone' || k === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, k === 'phone' ? 10 : 6) : e.target.value
    setF((o) => ({ ...o, [k]: v }))
    if (k === 'pincode') c.setPin(v)
  }

  // once the order is saved, go to its payment page (checked before the empty-cart rule below)
  if (placed) return <Navigate to={`/order/${placed}?new=1`} replace />
  if (!c.ready) return <div className="container-page py-20"><div className="skeleton h-64 rounded-3xl" /></div>
  if (!c.live.length) return <Navigate to="/cart" replace />

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (f.name.trim().length < 2) return setErr('Please enter your full name.')
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setErr('Please enter a valid 10-digit mobile number (we send order updates on WhatsApp).')
    if (!pickup) {
      if (f.address.trim().length < 8) return setErr('Please enter your full address (house, street, area).')
      if (f.city.trim().length < 2) return setErr('Please enter your village or town.')
      if (!c.q.deliverable) return setErr('We do not deliver to this pincode yet. Choose pickup in the cart, or use another address.')
    }
    if (!c.canCheckout) return setErr(c.problems[0] || 'Please check your cart.')
    setBusy(true)
    try {
      const customer = pickup
        ? { name: f.name.trim(), phone: f.phone, address: '', landmark: '', city: '', pincode: '' }
        : { name: f.name.trim(), phone: f.phone, address: f.address.trim(), landmark: f.landmark.trim(), city: f.city.trim(), pincode: f.pincode }
      try {
        localStorage.setItem(ADDR_KEY, JSON.stringify({ name: f.name, phone: f.phone, address: f.address, landmark: f.landmark, city: f.city }))
      } catch {}
      const id = await placeOrder({ user, customer, lines: c.live, method: c.method, payWhere: c.payWhere, q: c.q, pay: c.pay, wholesale: c.wholesale })
      setPlaced(id)
      clearCart()
    } catch (e2) {
      console.error(e2)
      setErr('Could not place the order. Please check your internet and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="container-page pb-16 pt-6 sm:pt-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link to="/cart" className="hover:text-gold">Cart</Link> <span className="mx-1.5">/</span> <span className="text-cream">Checkout</span>
      </nav>
      <h1 className="mt-3 text-4xl sm:text-5xl">Checkout</h1>

      <form onSubmit={submit} className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_24rem] lg:gap-10">
        <section className="min-w-0 rounded-3xl border border-plum-line bg-plum-card/60 p-5 sm:p-7">
          <h2 className="font-sans text-lg font-medium text-cream">{pickup ? 'Your details' : 'Delivery address'}</h2>
          {pickup && <p className="mt-1 text-sm text-muted">Pick up from {c.settings.pickup.place}. <Link to="/cart" className="text-gold hover:underline">Change</Link></p>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={f.name} onChange={set('name')} autoComplete="name" />
            <Input label="Mobile (WhatsApp)" value={f.phone} onChange={set('phone')} inputMode="numeric" autoComplete="tel-national" placeholder="10 digits" />
            {!pickup && (
              <>
                <Input className="sm:col-span-2" label="House no., street, area" value={f.address} onChange={set('address')} autoComplete="street-address" />
                <Input label="Landmark (optional)" value={f.landmark} onChange={set('landmark')} />
                <div>
                  <Input label="Village / town" value={f.city} onChange={set('city')} autoComplete="address-level2" />
                  {place && place.areas.length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted">Areas for {f.pincode} · {place.district} – tap yours:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {place.areas.map((a) => (
                          <button key={a} type="button" onClick={() => setF((o) => ({ ...o, city: `${a}, ${place.district}` }))}
                            className={`rounded-full border px-3 py-1 text-xs ${f.city.startsWith(a + ',') ? 'border-gold bg-gold/15 text-cream' : 'border-plum-line text-muted hover:border-gold/50'}`}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Input label="Pincode" value={f.pincode} onChange={set('pincode')} inputMode="numeric" autoComplete="postal-code" />
                  {f.pincode.length === 6 && !c.q.deliverable && <p className="mt-1.5 text-xs text-rose-light">We don’t deliver to this pincode yet.</p>}
                  {place && c.q.deliverable && <p className="mt-1.5 text-xs text-muted">{place.district}, {place.state}</p>}
                </div>
              </>
            )}
          </div>
          <p className="mt-5 text-xs text-muted">Logged in as {user?.email}. We send order updates on WhatsApp to this number.</p>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <section className="rounded-3xl border border-plum-line bg-plum-card/60 p-5">
            <h2 className="opt-title">Order summary ({cartCount(c.live)})</h2>
            <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {c.live.map((l) => (
                <li key={l.key} className="flex gap-3">
                  <span className="relative shrink-0">
                    <ArtImage src={img(l.image, true)} alt="" className="h-14 w-14 rounded-xl border border-plum-line bg-plum" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-white">{l.qty}</span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="line-clamp-1 text-cream">{l.name}</span>
                    <span className="block text-xs text-muted">{l.variant}{l.colour && ` · ${l.colour}`}</span>
                    {l.custom && <CustomSummary custom={l.custom} />}
                  </span>
                  <span className="text-sm text-cream">{formatINR(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-plum-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="text-cream">{formatINR(c.q.subtotal)}</dd></div>
              {c.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Wholesale discount</dt><dd className="text-[#8fd19e]">−{formatINR(c.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Delivery &amp; Packing</dt><dd className="text-cream">{c.q.free ? 'Free 🎉' : c.q.deliveryPacking == null ? '—' : formatINR(c.q.deliveryPacking)}</dd></div>
              <div className="flex justify-between border-t border-plum-line pt-3 text-base"><dt className="text-cream">Total</dt><dd className="font-medium text-cream">{formatINR(c.q.total)}</dd></div>
            </dl>
            {(c.pay.hasCustom || c.payAtPickup || c.wholesale) && <PaySplit pay={c.pay} method={c.method} hasReady={c.pay.ready > 0} payAtPickup={c.payAtPickup} wholesale={c.wholesale} />}
            {err && <p role="alert" className="mt-4 rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-blush">{err}</p>}
            <button type="submit" disabled={busy} className="btn-rose shimmer mt-5 w-full disabled:opacity-60">
              {busy ? 'Placing order…' : c.pay.now > 0 ? <>Place order &amp; pay {formatINR(c.pay.now)} <IconArrow className="h-4 w-4" /></> : 'Place order'}
            </button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted"><IconShield className="h-4 w-4 text-gold" /> Pay securely by UPI on the next step</p>
          </section>
        </aside>
      </form>
    </div>
  )
}

function Input({ label, className = '', ...rest }) {
  return (
    <label className={`block text-sm text-muted ${className}`}>
      {label}
      <input className="field mt-1.5 w-full rounded-2xl" {...rest} />
    </label>
  )
}
