export async function showSavedNotification({ title = 'Tabs saved to Notion', message = '', isError = false } = {}) {
  try {
    if (!chrome.notifications?.create) return false;
    const id = `t2n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message: message || (isError ? 'Some tabs could not be saved.' : 'Tabs were saved to Notion.'),
      priority: isError ? 1 : 0,
      silent: false
    });
    return true;
  } catch (error) {
    console.warn('Could not show Tabs2Notion notification', error);
    return false;
  }
}
