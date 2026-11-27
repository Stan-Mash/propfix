import React, { createContext, useContext, useState, useMemo } from 'react';
import { PROPERTIES, UNITS, MASTER_HISTORY, RENT_COLLECTED, UNIT_COST_PER_M3 } from '../data/seed';
import { todayISO } from '../utils/dates';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (d = new Date()) => `${MON[d.getMonth()]} ${d.getFullYear()}`;

const PortfolioContext = createContext({});
export const usePortfolio = () => useContext(PortfolioContext);

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const unitUsed = (u) => Math.max(0, (u.presentReading || 0) - (u.prevReading || 0));

export function PortfolioProvider({ children }) {
  const [properties, setProperties] = useState(() => PROPERTIES.map(p => ({ waterRate: UNIT_COST_PER_M3, ...p })));
  const [units, setUnits] = useState(() => Object.fromEntries(Object.entries(UNITS).map(([k, list]) => [k, list.map(u => ({ ...u }))])));
  const [masterHistory, setMasterHistory] = useState(() => Object.fromEntries(Object.entries(MASTER_HISTORY).map(([k, rows]) => [k, rows.map(r => ({ ...r }))])));

  const mapUnits = (propertyId, fn) => setUnits(prev => ({ ...prev, [propertyId]: fn(prev[propertyId] || []) }));
  const patchUnit = (propertyId, unitId, patch) => mapUnits(propertyId, list => list.map(u => (u.id === unitId ? { ...u, ...(typeof patch === 'function' ? patch(u) : patch) } : u)));

  // ---- Properties ----
  const addProperty = (data, bulk) => {
    const id = uid('prop');
    const master = num(data.masterMeterReading);
    setProperties(prev => [...prev, {
      id, name: data.name.trim(), location: data.location.trim(), address: data.address?.trim() || data.location.trim(),
      waterRate: num(data.waterRate) || UNIT_COST_PER_M3,
      masterMeterReading: master, lastMasterMeter: master, bowserLitres: 0,
      managerId: data.managerId || null, caretakerId: data.caretakerId || null, monthlySpend: 0,
    }]);
    const generated = [];
    if (bulk?.enabled) {
      const count = Math.min(200, Math.max(0, Math.floor(num(bulk.count))));
      for (let i = 1; i <= count; i++) {
        generated.push(blankUnit(id, `${(bulk.prefix || '').trim()}${i}`, num(bulk.rent), 0));
      }
    }
    setUnits(prev => ({ ...prev, [id]: generated }));
    setMasterHistory(prev => ({ ...prev, [id]: [{ id: uid('mm'), month: monthLabel(), prev: master, pres: master, bowser: 0, subTotal: null, recordedAt: null }] }));
    return id;
  };

  const updateProperty = (id, patch) => setProperties(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const deleteProperty = (id) => {
    setProperties(prev => prev.filter(p => p.id !== id));
    setUnits(prev => { const next = { ...prev }; delete next[id]; return next; });
    setMasterHistory(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  // ---- Units ----
  const blankUnit = (propertyId, label, rent, reading) => ({
    id: uid(`u_${propertyId.slice(-4)}`), unit: label, tenant: '', phone: '', email: '',
    rent: rent || 0, depositPaid: 0, arrears: 0, prevReading: reading || 0, presentReading: reading || 0,
    status: 'vacant', moveInDate: null, moveInMeterReading: null, meterHistory: [], pastTenants: [],
  });

  const addUnit = (propertyId, data) => {
    const u = blankUnit(propertyId, data.unit.trim(), num(data.rent), num(data.reading));
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
      rent: num(data.rent), depositPaid: num(data.depositPaid), arrears: 0,
      status: 'occupied', moveInDate: data.moveInDate || todayISO(), moveInMeterReading: reading,
      prevReading: reading, presentReading: reading, meterHistory: [],
    });
  };

  // Archives the tenant, keeps the closing reading as the next tenant's starting point
  const vacateTenant = (propertyId, unitId) => patchUnit(propertyId, unitId, (u) => ({
    pastTenants: [...(u.pastTenants || []), {
      tenant: u.tenant, phone: u.phone, email: u.email, moveInDate: u.moveInDate, moveOutDate: todayISO(),
      moveInMeterReading: u.moveInMeterReading, closingReading: u.presentReading, arrears: u.arrears, meterHistory: u.meterHistory || [],
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
      if (last && last.month === label) {
        return { ...prev, [propertyId]: rows.map(r => (r === last ? { ...r, pres: reading, bowser, recordedAt: stamp } : r)) };
      }
      const closed = last ? rows.map(r => (r === last && r.subTotal == null ? { ...r, subTotal: (units[propertyId] || []).reduce((s, u) => s + unitUsed(u), 0) } : r)) : rows;
      return { ...prev, [propertyId]: [...closed, { id: uid('mm'), month: label, prev: last ? last.pres : reading, pres: reading, bowser, subTotal: null, recordedAt: stamp }] };
    });
    setProperties(prev => prev.map(p => {
      if (p.id !== propertyId) return p;
      const rows = masterHistory[propertyId] || [];
      const last = rows[rows.length - 1];
      const sameMonth = last && last.month === label;
      return { ...p, masterMeterReading: reading, lastMasterMeter: sameMonth ? p.lastMasterMeter : p.masterMeterReading, bowserLitres: bowser * 1000 };
    }));
  };

  const value = useMemo(() => {
    const subTotal = (propertyId) => (units[propertyId] || []).reduce((s, u) => s + unitUsed(u), 0);

    // One row of the master ledger with its water balance worked out
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
      const monthlyRent = list.reduce((s, u) => s + (u.rent || 0), 0);
      const occupiedRent = list.filter(u => u.tenant).reduce((s, u) => s + (u.rent || 0), 0);
      const collected = RENT_COLLECTED[propertyId] != null ? Math.min(RENT_COLLECTED[propertyId], monthlyRent) : occupiedRent;
      return { monthlyRent, collected };
    };

    const findUnit = (propertyId, unitRef) => (units[propertyId] || []).find(u => u.id === unitRef || u.unit === unitRef);

    return {
      properties, units, masterHistory,
      addProperty, updateProperty, deleteProperty,
      addUnit, updateUnit, deleteUnit,
      addTenant, vacateTenant, logMasterReading,
      getMasterLedger, getVariance, getRent, findUnit,
    };
  }, [properties, units, masterHistory]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
