// src/data/pincode.js — village / area names for a pincode, from the free India Post pincode service
// (api.postalpincode.in). Used to show "Pothavaram, West Godavari" in the cart and to fill the town at checkout.
// If the service is slow or down, everything still works – the names just don't appear.
import { useEffect, useState } from 'react'

const cache = new Map()

/** { areas: ['Pothavaram', …], district: 'West Godavari', state: 'Andhra Pradesh' } or null */
export async function lookupPin(pin) {
  if (!/^[1-9][0-9]{5}$/.test(pin)) return null
  if (cache.has(pin)) return cache.get(pin)
  const job = (async () => {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 6000)
      const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctl.signal })
      clearTimeout(t)
      const j = await r.json()
      const offices = j?.[0]?.Status === 'Success' ? j[0].PostOffice || [] : []
      if (!offices.length) return null
      return {
        areas: [...new Set(offices.map((o) => String(o.Name || '').trim()).filter(Boolean))].slice(0, 20),
        district: offices[0].District || '',
        state: offices[0].State || '',
      }
    } catch {
      cache.delete(pin) // try again next time
      return null
    }
  })()
  cache.set(pin, job)
  return job
}

/** React hook: the place for a 6-digit pincode (null while loading or unknown). */
export function usePinPlace(pin) {
  const [place, setPlace] = useState(null)
  useEffect(() => {
    let live = true
    if (!/^[1-9][0-9]{5}$/.test(pin || '')) return
    lookupPin(pin).then((p) => live && setPlace(p ? { ...p, pin } : null))
    return () => {
      live = false
    }
  }, [pin])
  return place && place.pin === pin ? place : null
}
