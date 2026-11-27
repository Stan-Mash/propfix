const TABS = { landlord: 'LandlordTabs', manager: 'ManagerTabs', caretaker: 'CaretakerTabs' };

// Open the Repairs tab with a filter applied. Works from a tab screen and from a
// stack screen sitting above the tabs (which must pop back rather than push new tabs).
export function openRepairs(navigation, role, params = {}) {
  const p = { ...params, ts: Date.now() };
  if (typeof navigation.jumpTo === 'function') navigation.navigate('Maintenance', p);
  else navigation.popTo(TABS[role] || TABS.landlord, { screen: 'Maintenance', params: p });
}
