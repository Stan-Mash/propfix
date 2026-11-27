import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UNIT_COST_PER_M3 } from '../data/seed';
import { todayISO } from '../utils/dates';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (d = new Date()) => `${MON[d.getMonth()]} ${d.getFullYear()}`;

const PortfolioContext = createContext({});
export const usePortfolio = () => useContext(PortfolioContext);

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const unitUsed = (u) => Math.max(0, (u.presentReading || 0) - (u.prevReading || 0));

// Compute the total monthly charge from a unit's payables array.
// Falls back to the flat `rent` field for backward compatibility.
export const computeUnitTotal = (unit) => {
  if (!unit.payables?.length) return unit.rent || 0;
  return unit.payables
    .filter(p => p.enabled !== false)
    .reduce((sum, p) => {
      if (p.type === 'fixed') return sum + (p.amount || 0);
      if (p.type === 'percent_rent') {
        const base = (unit.payables || []).filter(x => x.label === 'Base Rent' && x.enabled !== false).reduce((s, x) => s + (x.amount || 0), 0);
        return sum + base * ((p.percentage || 0) / 100);
      }
      return sum;
    }, 0);
};

// Default payables template for a residential unit
export const defaultPayables = (rent = 0, waterRate = UNIT_COST_PER_M3) => [
  { id: uid('pa'), type: 'fixed', label: 'Base Rent', amount: rent, enabled: true },
  { id: uid('pa'), type: 'metered_water', label: 'Water', rate: waterRate, enabled: true },
  { id: uid('pa'), type: 'fixed', label: 'Service Charge', amount: 0, enabled: false },
  { id: uid('pa'), type: 'fixed', label: 'Garbage Collection', amount: 0, enabled: false },
  { id: uid('pa'), type: 'fixed', label: 'Security', amount: 0, enabled: false },
];

export function PortfolioProvider({ children }) {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState({});
  const [masterHistory, setMasterHistory] = useState({});
  const [payments, setPayments] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Persist to Firestore debounced
  const saveTimer = useRef(null);
  const stateRef = useRef({ properties, units, masterHistory });

  useEffect(() => {
    stateRef.current = { properties, units, masterHistory, payments };
  }, [properties, units, masterHistory, payments]);

  // Load from Firestore on mount (once per session)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoaded(true); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'portfolios', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.properties) setProperties(d.properties);
          if (d.units) setUnits(d.units);
          if (d.masterHistory) setMasterHistory(d.masterHistory);
          if (d.payments) setPayments(d.payments);
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  // Debounced save to Firestore (500ms after last write)
  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const user = auth.currentUser;
      if (!user) return;
      const { properties: p, units: u, masterHistory: mh, payments: pm } = stateRef.current;
      setDoc(doc(db, 'portfolios', user.uid), { properties: p, units: u, masterHistory: mh, payments: pm }).catch(() => {});
    }, 500);
  };

  const mapUnits = (propertyId, fn) => {
    setUnits(prev => { const next = { ...prev, [propertyId]: fn(prev[propertyId] || []) }; scheduleSave(); return next; });
  };
  const patchUnit = (propertyId, unitId, patch) =>
    mapUnits(propertyId, list => list.map(u => (u.id === unitId ? { ...u, ...(typeof patch === 'function' ? patch(u) : patch) } : u)));

  // ---- Properties ----
  const addProperty = (data, bulk, tiers) => {
    const id = uid('prop');
    const master = num(data.masterMeterReading);
    const wRate = num(data.waterRate) || UNIT_COST_PER_M3;

    setProperties(prev => {
      const next = [...prev, {
        id, name: data.name.trim(), location: data.location.trim(), address: data.address?.trim() || data.location.trim(),
        waterRate: wRate, powerRate: num(data.powerRate) || 0,
        paybill: data.paybill?.trim() || '', billingDueDay: num(data.billingDueDay) || 1,
        masterMeterReading: master, lastMasterMeter: master, bowserLitres: 0,
        managerId: data.managerId || null, caretakerId: data.caretakerId || null, monthlySpend: 0,
        coverPhoto: data.coverPhoto || null, tiers: tiers || [],
      }];
      scheduleSave(); return next;
    });

    // Generate units from tiers or bulk
    const generated = [];
    if (tiers?.length) {
      for (const tier of tiers) {
        const count = Math.min(200, Math.max(0, Math.floor(num(tier.count))));
        for (let i = 1; i <= count; i++) {
          const label = `${(tier.prefix || '').trim()}${i}`;
          generated.push({
            ...blankUnit(id, label, 0, master),
            tierId: tier.id,
            payables: (tier.payables || []).map(p => ({ ...p, id: uid('pa') })),
            rent: (tier.payables || []).filter(p => p.type === 'fixed' && p.enabled !== false).reduce((s, p) => s + (p.amount || 0), 0),
          });
        }
      }
    } else if (bulk?.enabled) {
      const count = Math.min(200, Math.max(0, Math.floor(num(bulk.count))));
      for (let i = 1; i <= count; i++) {
        const label = `${(bulk.prefix || '').trim()}${i}`;
        generated.push({
          ...blankUnit(id, label, num(bulk.rent), master),
          payables: defaultPayables(num(bulk.rent), wRate),
        });
      }
    }
    setUnits(prev => { const next = { ...prev, [id]: generated }; scheduleSave(); return next; });
    setMasterHistory(prev => {
      const next = { ...prev, [id]: [{ id: uid('mm'), month: monthLabel(), prev: master, pres: master, bowser: 0, subTotal: null, recordedAt: null }] };
      scheduleSave(); return next;
    });
    return id;
  };

  const updateProperty = (id, patch) => {
    setProperties(prev => { const next = prev.map(p => (p.id === id ? { ...p, ...patch } : p)); scheduleSave(); return next; });
  };

  const deleteProperty = (id) => {
    setProperties(prev => { const next = prev.filter(p => p.id !== id); scheduleSave(); return next; });
    setUnits(prev => { const next = { ...prev }; delete next[id]; scheduleSave(); return next; });
    setMasterHistory(prev => { const next = { ...prev }; delete next[id]; scheduleSave(); return next; });
  };

  // ---- Units ----
  const blankUnit = (propertyId, label, rent, reading) => ({
    id: uid(`u_${propertyId.slice(-4)}`), unit: label, tenant: '', phone: '', email: '',
    rent: rent || 0, depositPaid: 0, arrears: 0,
    prevReading: reading || 0, presentReading: reading || 0,
    powerPrevReading: 0, powerPresentReading: 0,
    status: 'vacant', moveInDate: null, moveInMeterReading: null, meterHistory: [],
    pastTenants: [], payables: [],
  });

  const addUnit = (propertyId, data) => {
    const prop = properties.find(p => p.id === propertyId);
    const wRate = prop?.waterRate || UNIT_COST_PER_M3;
    const rent = num(data.rent);
    const u = {
      ...blankUnit(propertyId, data.unit.trim(), rent, num(data.reading)),
      payables: data.payables?.length ? data.payables : defaultPayables(rent, wRate),
      tierId: data.tierId || null,
    };
    mapUnits(propertyId, list => [...list, u]);
    return u.id;
  };

  const updateUnit = (propertyId, unitId, patch) => patchUnit(propertyId, unitId, patch);
  const deleteUnit = (propertyId, unitId) => mapUnits(propertyId, list => list.filter(u => u.id !== unitId));

  // ---- Tenants ----
  const addTenant = (propertyId, unitId, data) => {
    const reading = num(data.moveInMeterReading);
    patchUnit(propertyId, unitId, {
      tenant: data.tenant.trim(), phone: data.phone.trim(), email: (data.email || '').trim(),
      rent: num(data.rent), depositPaid: num(data.depositPaid), arrears: num(data.openingArrears) || 0,
      status: data.status || 'occupied', moveInDate: data.moveInDate || todayISO(),
      moveInMeterReading: reading, prevReading: reading, presentReading: reading, meterHistory: [],
    });
  };

  const vacateTenant = (propertyId, unitId) => patchUnit(propertyId, unitId, (u) => ({
    pastTenants: [...(u.pastTenants || []), {
      tenant: u.tenant, phone: u.phone, email: u.email, moveInDate: u.moveInDate, moveOutDate: todayISO(),
      moveInMeterReading: u.moveInMeterReading, closingReading: u.presentReading,
      arrears: u.arrears, meterHistory: u.meterHistory || [],
    }],
    tenant: '', phone: '', email: '', arrears: 0, depositPaid: 0, status: 'vacant',
    moveInDate: null, moveInMeterReading: null, meterHistory: [], prevReading: u.presentReading,
  }));

  // ---- Master meter ----
  const logMasterReading = (propertyId, reading, bowser = 0) => {
    const label = monthLabel();
    setMasterHistory(prev => {
      const rows = prev[propertyId] || [];
      const last = rows[rows.length - 1];
      const stamp = todayISO();
      let next;
      if (last && last.month === label) {
        next = { ...prev, [propertyId]: rows.map(r => (r === last ? { ...r, pres: reading, bowser, recordedAt: stamp } : r)) };
      } else {
        const closed = last ? rows.map(r => (r === last && r.subTotal == null ? { ...r, subTotal: (units[propertyId] || []).reduce((s, u) => s + unitUsed(u), 0) } : r)) : rows;
        next = { ...prev, [propertyId]: [...closed, { id: uid('mm'), month: label, prev: last ? last.pres : reading, pres: reading, bowser, subTotal: null, recordedAt: stamp }] };
      }
      scheduleSave(); return next;
    });
    setProperties(prev => {
      const next = prev.map(p => {
        if (p.id !== propertyId) return p;
        const rows = masterHistory[propertyId] || [];
        const last = rows[rows.length - 1];
        const sameMonth = last && last.month === label;
        return { ...p, masterMeterReading: reading, lastMasterMeter: sameMonth ? p.lastMasterMeter : p.masterMeterReading, bowserLitres: bowser * 1000 };
      });
      scheduleSave(); return next;
    });
  };

  // ---- Payments ----
  const logPayment = (propertyId, unitId, monthKey, data) => {
    const entry = { id: uid('pay'), amount: num(data.amount), mpesaRef: (data.mpesaRef || '').trim(), paidAt: todayISO(), note: (data.note || '').trim() };
    setPayments(prev => {
      const propPays = prev[propertyId] || {};
      const unitPays = propPays[unitId] || {};
      const monthPays = unitPays[monthKey] || [];
      const next = { ...prev, [propertyId]: { ...propPays, [unitId]: { ...unitPays, [monthKey]: [...monthPays, entry] } } };
      scheduleSave(); return next;
    });
  };

  // Roll unpaid balances into arrears for the given property + month.
  // For each occupied unit: if paidTotal < totalDue, the difference is added to unit.arrears.
  const rollArrears = (propertyId, monthKey) => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return 0;
    let count = 0;
    mapUnits(propertyId, list => list.map(u => {
      if (!u.tenant) return u;
      const payables = u.payables || [];
      let totalDue = payables.filter(p => p.enabled !== false).reduce((s, p) => {
        if (p.type === 'fixed') return s + (p.amount || 0);
        if (p.type === 'metered_water') return s + Math.max(0, (u.presentReading || 0) - (u.prevReading || 0)) * (p.rate || prop.waterRate || 65);
        return s;
      }, 0);
      if (payables.length === 0) totalDue = u.rent || 0;
      totalDue += u.arrears || 0;
      const paid = ((stateRef.current.payments[propertyId] || {})[u.id] || {})[monthKey]?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
      const shortfall = Math.max(0, totalDue - paid);
      if (shortfall > 0) { count++; return { ...u, arrears: shortfall }; }
      return { ...u, arrears: 0 };
    }));
    return count;
  };

  const removePayment = (propertyId, unitId, monthKey, paymentId) => {
    setPayments(prev => {
      const propPays = prev[propertyId] || {};
      const unitPays = propPays[unitId] || {};
      const monthPays = (unitPays[monthKey] || []).filter(p => p.id !== paymentId);
      const next = { ...prev, [propertyId]: { ...propPays, [unitId]: { ...unitPays, [monthKey]: monthPays } } };
      scheduleSave(); return next;
    });
  };

  const value = useMemo(() => {
    const subTotal = (propertyId) => (units[propertyId] || []).reduce((s, u) => s + unitUsed(u), 0);

    const ledgerRow = (propertyId, r) => {
      const used = Math.max(0, r.pres - r.prev);
      const sub = r.subTotal == null ? subTotal(propertyId) : r.subTotal;
      const supplied = used + (r.bowser || 0);
      const variance = supplied - sub;
      const variancePct = supplied > 0 ? (variance / supplied) * 100 : 0;
      return { ...r, used, sub, supplied, variance, variancePct, hasLeak: variancePct > 10, isCurrent: r.subTotal == null };
    };

    const getMasterLedger = (propertyId) => (masterHistory[propertyId] || []).map(r => ledgerRow(propertyId, r));

    const getVariance = (propertyId) => {
      const p = properties.find(x => x.id === propertyId);
      if (!p) return null;
      const r = ledgerRow(propertyId, { prev: p.lastMasterMeter, pres: p.masterMeterReading, bowser: Math.round((p.bowserLitres || 0) / 1000), subTotal: null });
      return { masterConsumption: r.used, subMeterTotal: r.sub, bowser: r.bowser, variance: r.variance, variancePct: r.variancePct, hasLeak: r.hasLeak };
    };

    const getRent = (propertyId) => {
      const list = units[propertyId] || [];
      const monthlyRent = list.reduce((s, u) => s + computeUnitTotal(u), 0);
      const occupiedRent = list.filter(u => u.tenant).reduce((s, u) => s + computeUnitTotal(u), 0);
      return { monthlyRent, collected: occupiedRent };
    };

    const findUnit = (propertyId, unitRef) => (units[propertyId] || []).find(u => u.id === unitRef || u.unit === unitRef);

    const paymentsFor = (propertyId, unitId, monthKey) =>
      ((payments[propertyId] || {})[unitId] || {})[monthKey] || [];

    const paidTotal = (propertyId, unitId, monthKey) =>
      paymentsFor(propertyId, unitId, monthKey).reduce((s, p) => s + (p.amount || 0), 0);

    return {
      properties, units, masterHistory, payments, loaded,
      addProperty, updateProperty, deleteProperty,
      addUnit, updateUnit, deleteUnit,
      addTenant, vacateTenant, logMasterReading,
      getMasterLedger, getVariance, getRent, findUnit,
      logPayment, removePayment, rollArrears, paymentsFor, paidTotal,
      computeUnitTotal, defaultPayables,
    };
  }, [properties, units, masterHistory, payments, loaded]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
