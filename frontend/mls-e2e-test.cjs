const { chromium } = require('playwright');
const app = 'https://localhost:5173';
const password = 'Password123!';
const stamp = Date.now().toString().slice(-8);
const owner = { fullName: `MLS Owner ${stamp}`, email: `mls.owner.${stamp}@example.com`, password };
const member = { fullName: `MLS Member ${stamp}`, email: `mls.member.${stamp}@example.com`, password };

async function signup(page, user) {
  await page.goto(`${app}/signup`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('John Doe').fill(user.fullName);
  await page.getByPlaceholder('johndoe@gmail.com').fill(user.email);
  await page.getByPlaceholder('Enter your password').fill(user.password);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/signup')).catch(() => null),
    page.getByRole('button', { name: /create account/i }).click(),
  ]);
  await page.waitForTimeout(1000);
}
async function logout(page) {
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.clear();
  });
}
async function login(page, user) {
  await page.goto(`${app}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login')).catch(() => null),
    page.getByRole('button', { name: /sign in|login/i }).click(),
  ]);
  await page.waitForTimeout(1500);
}
async function handlePassphraseModal(page) {
  try {
    await page.waitForSelector('#skip-backup-btn, #generate-new-keys-btn, #close-modal-btn', { timeout: 2000 });
  } catch (e) {}
  const skip = page.locator('#skip-backup-btn');
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(1500); return; }
  const generateNew = page.locator('#generate-new-keys-btn');
  if (await generateNew.count()) { await generateNew.click(); await page.waitForTimeout(1500); return; }
  const close = page.locator('#close-modal-btn');
  if (await close.count()) { await close.click(); await page.waitForTimeout(500); }
}
async function ensureMlsViaGroups(page) {
  await handlePassphraseModal(page);
  await page.getByRole('button', { name: 'Groups' }).click();
  await page.waitForTimeout(2500);
  await handlePassphraseModal(page);
}
async function currentUser(page) {
  return page.evaluate(async () => (await fetch('/api/auth/check', { credentials: 'include' })).json());
}
async function createGroup(page, groupName, memberName) {
  const events = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/groups')) {
      let body = '';
      try { body = await res.text(); } catch {}
      events.push({ method: res.request().method(), path: new URL(url).pathname, status: res.status(), body: body.slice(0, 500) });
    }
  });
  await handlePassphraseModal(page);
  await page.getByRole('button', { name: 'Groups' }).click();
  await handlePassphraseModal(page);
  await page.getByRole('button', { name: /create group/i }).click();
  await page.getByPlaceholder('Group name').fill(groupName);
  await page.getByText(memberName, { exact: true }).click();
  await page.locator('form').getByRole('button', { name: 'Create group' }).click();
  await page.waitForTimeout(5000);
  return events;
}
async function sendGroupMessage(page, groupName, text) {
  await handlePassphraseModal(page);
  await page.getByRole('button', { name: 'Groups' }).click();
  await handlePassphraseModal(page);
  await page.getByText(groupName, { exact: true }).first().click();
  const messagePost = page.waitForResponse(r => /\/api\/groups\/[^/]+\/messages$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 15000 }).catch(e => ({ error: e.message }));
  const input = page.locator('input[placeholder*="message"]');
  await input.fill(text);
  await page.keyboard.press('Enter');
  const res = await messagePost;
  await page.waitForTimeout(1500);
  if (res && res.status) {
    let body = '';
    try { body = await res.text(); } catch {}
    return { status: res.status(), body: body.slice(0, 500), visible: await page.getByText(text).count() };
  }
  return { error: res.error, visible: await page.getByText(text).count() };
}
(async () => {
  console.log('Launching browser...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Chromium/Application/chrome.exe' });
    console.log('Successfully launched custom Chromium.');
  } catch (e) {
    console.log('Could not launch custom Chromium, falling back to default Playwright browser...');
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER PAGE ERROR] ${err.stack || err.message}`);
  });
  page.setDefaultTimeout(15000);
  const result = { owner, member };
  
  console.log('Step 1: Signing up member user:', member.email);
  await signup(page, member);
  result.memberAfterSignup = await currentUser(page).catch(e => ({ error: e.message }));
  console.log('Step 2: Initializing MLS for member...');
  await ensureMlsViaGroups(page);
  console.log('Step 3: Logging out member...');
  await logout(page);
  
  console.log('Step 4: Signing up owner user:', owner.email);
  await signup(page, owner);
  result.ownerAfterSignup = await currentUser(page).catch(e => ({ error: e.message }));
  console.log('Step 5: Initializing MLS for owner...');
  await ensureMlsViaGroups(page);
  
  const groupName = `MLS E2E ${stamp}`;
  result.groupName = groupName;
  console.log(`Step 6: Owner creating group "${groupName}" with member "${member.fullName}"...`);
  result.groupCreateEvents = await createGroup(page, groupName, member.fullName);
  
  console.log('Step 7: Owner sending encrypted group message...');
  result.sendAsOwner = await sendGroupMessage(page, groupName, `hello group ${stamp}`);
  
  console.log('Step 8: Logging out owner...');
  await logout(page);
  
  console.log('Step 9: Logging in as member...');
  await login(page, member);
  console.log('Step 10: Going to groups list...');
  await ensureMlsViaGroups(page);
  await page.getByRole('button', { name: 'Groups' }).click();
  await page.waitForTimeout(1500);
  
  result.groupVisibleForMember = await page.getByText(groupName, { exact: true }).count();
  console.log('Group visible for member:', !!result.groupVisibleForMember);
  
  if (result.groupVisibleForMember) {
    console.log('Step 11: Member entering group...');
    await page.getByText(groupName, { exact: true }).first().click();
    await page.waitForTimeout(3000);
    result.messageVisibleForMember = await page.getByText(`hello group ${stamp}`).count();
    console.log('Decrypted message visible for member:', !!result.messageVisibleForMember);
    result.memberPageText = (await page.locator('body').innerText()).slice(0, 2000);
  }
  
  console.log('E2E Test Result Summary:');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  
  if (!result.groupVisibleForMember || !result.messageVisibleForMember) {
    console.error('FAIL: MLS group creation or encrypted messaging E2E flow failed!');
    process.exit(1);
  }
  console.log('SUCCESS: MLS E2E flow verified successfully!');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });


