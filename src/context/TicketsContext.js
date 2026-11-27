import React, { createContext, useContext, useState } from 'react';
import { TICKETS, CONTRACTORS } from '../data/seed';
import { todayISO } from '../utils/dates';

const TicketsContext = createContext({});
export const useTickets = () => useContext(TicketsContext);

export function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState(() => TICKETS.map(t => ({ ...t })));
  const [bonuses, setBonuses] = useState({});

  const approveTicket = (ticketId, quotationId) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const selQ = t.quotations?.find(q => q.id === quotationId) || t.quotations?.find(q => q.recommended) || t.quotations?.[0];
      const workerId = selQ?.workerId;
      const contractor = workerId ? CONTRACTORS[workerId] : null;
      const now = new Date();
      const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return {
        ...t,
        status: 'approved',
        selectedContractorId: selQ?.id,
        approvedAt: now.toISOString(),
        assignedRepairer: selQ ? { workerId, name: contractor?.name || selQ.contractor, phone: selQ.phone } : undefined,
        expectedCompletion: expected.toISOString().slice(0, 10),
      };
    }));
  };

  const rejectTicket = (ticketId) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'rejected' } : t));
  };

  const updateTicketStatus = (ticketId, newStatus, extra = {}) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const done = newStatus === 'resolved' ? { resolvedAt: new Date().toISOString(), actualCompletion: todayISO() } : {};
      return { ...t, ...extra, ...done, status: newStatus };
    }));
  };

  const addQuotation = (ticketId, quotation) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const newQ = { ...quotation, id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
      const newStatus = t.status === 'reported' ? 'quotes_uploaded' : t.status;
      return { ...t, status: newStatus, quotations: [...(t.quotations || []), newQ] };
    }));
  };

  const addTicket = (data) => {
    const ticket = {
      id: `tkt_${Date.now()}`,
      status: 'reported',
      createdAt: new Date().toISOString(),
      repeatAlert: false,
      quotations: [],
      photos: [],
      benchmarkCost: 0,
      occurrenceCount: 1,
      ...data,
    };
    setTickets(prev => [ticket, ...prev]);
    return ticket;
  };

  const savePayment = (ticketId, payments) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, payments: { ...(t.payments || {}), ...payments } } : t));
  };

  const awardBonus = (workerId) => setBonuses(prev => ({ ...prev, [workerId]: todayISO() }));

  return (
    <TicketsContext.Provider value={{ tickets, bonuses, approveTicket, rejectTicket, updateTicketStatus, addQuotation, addTicket, savePayment, awardBonus }}>
      {children}
    </TicketsContext.Provider>
  );
}
