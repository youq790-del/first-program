chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try { await chrome.tabs.sendMessage(tab.id, {type: 'yo7-toggle'}); }
  catch { /* Refresh a tab that was opened before installation. */ }
});
