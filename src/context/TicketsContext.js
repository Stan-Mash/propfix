import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { CONTRACTORS } from '../data/seed';
import { todayISO } from '../utils/dates';

const TicketsContext = createContext({});
export const useTickets = () => useContext(TicketsContext);

export function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [bonuses, setBonuses] = useState({});
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef(null);
  const stateRef = useRef({ tickets, bonuses });

  useEffect(() => { stateRef.current = { tickets, bonuses }; }, [tickets, bonuses]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoaded(true); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tickets', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.tickets) setTickets(d.tickets);
          if (d.bonuses) setBonuses(d.bonuses);
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const user = auth.currentUser;
      if (!user) return;
      const { tickets: t, bonuses: b } = stateRef.current;
      setDoc(doc(db, 'tickets', user.uid), { tickets: t, bonuses: b }).catch(() => {});
    }, 500);
  };

  const save = (fn) => {
    setTickets(prev => { const next = fn(prev); scheduleSave(); return next; });
  };

  const approveTicket = (ticketId, quotationId) => {
    save(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const selQ = t.quotations?.find(q => q.id === quotationId) || t.quotations?.find(q => q.recommended) || t.quotations?.[0];
      const workerId = selQ?.workerId;
      const contractor = workerId ? CONTRACTORS[workerId] : null;
      const now = new Date();
      const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return {
        ...t, status: 'approved', selectedContractorId: selQ?.id,
        approvedAt: now.toISOString(),
        assignedRepairer: selQ ? { workerId, name: contractor?.name || selQ.contractor, phone: selQ.phone } : undefined,
        expectedCompletion: expected.toISOString().slice(0, 10),
      };
    }));
  };

  const rejectTicket = (ticketId) => save(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'rejected' } : t));

  const updateTicketStatus = (ticketId, newStatus, extra = {}) => {
    save(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const done = newStatus === 'resolved' ? { resolvedAt: new Date().toISOString(), actualCompletion: todayISO() } : {};
      return { ...t, ...extra, ...done, status: newStatus };
    }));
  };

  const addQuotation = (ticketId, quotation) => {
    save(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const newQ = { ...quotation, id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
      const newStatus = t.status === 'reported' ? 'quotes_uploaded' : t.status;
      return { ...t, status: newStatus, quotations: [...(t.quotations || []), newQ] };
    }));
  };

  const addTicket = (data) => {
    const ticket = {
      id: `tkt_${Date.now()}`, status: 'reported',
      createdAt: new Date().toISOString(), repeatAlert: false,
      quotations: [], photos: [], benchmarkCost: 0, occurrenceCount: 1,
      ...data,
    };
    save(prev => [ticket, ...prev]);
    return ticket;
  };

  const savePayment = (ticketId, payments) => {
    save(prev => prev.map(t => t.id === ticketId ? { ...t, payments: { ...(t.payments || {}), ...payments } } : t));
  };

  const awardBonus = (workerId) => {
    setBonuses(prev => { const next = { ...prev, [workerId]: todayISO() }; scheduleSave(); return next; });
  };

  return (
    <TicketsContext.Provider value={{ tickets, bonuses, loaded, approveTicket, rejectTicket, updateTicketStatus, addQuotation, addTicket, savePayment, awardBonus }}>
      {children}
    </TicketsContext.Provider>
  );
}
