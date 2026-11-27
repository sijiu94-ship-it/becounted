import re
p = 'web/assets/app.js'
s = open(p, encoding='utf-8').read()
start = s.index('async function loadPlatformStats(){')
end = s.index('/* ---------- campaign poster (16:9) ---------- */')
new = '''async function loadPlatformStats(){
  if(!$("statHumans") || _statsLoading) return;
  _statsLoading = true;
  chain();
  try{
    // Direct contract reads only. The previous version scanned every event
    // log since the deploy block, so the homepage got slower with every new
    // block the chain produced; this stays flat as history grows.
    const n = Number(await appsRead.campaignCount());
    const humans = new Set(); let payouts = 0;
    for (let i = 0; i < n; i++){
      const c = await appsRead.getCampaign(i);
      const entries = await appsRead.getEntries(i);
      for (const a of entries) humans.add(a);
      if (Number(c.kind) === 2) payouts += entries.length; // claim drop: every entry was paid on entry
      else if (c.drawn) { // raffle / vote pool: count winners who actually claimed
        let winners = [];
        try { winners = await appsRead.getWinners(i); } catch(e) {}
        for (const w of winners) { try { if (await appsRead.prizeClaimed(i, w)) payouts++; } catch(e) {} }
      }
    }
    $("statHumans").textContent = humans.size;
    if($("statPayouts")) $("statPayouts").textContent = payouts;
  }catch(e){ /* keep last rendered values */ }
  _statsLoading = false;
}

'''
s = s[:start] + new + s[end:]
# version bump 1121x -> 1121y in app.js self-references and all pages
s = s.replace('1121x', '1121y')
open(p, 'w', encoding='utf-8').write(s)
import glob
for f in glob.glob('web/*.html'):
    t = open(f, encoding='utf-8').read()
    if '1121x' in t:
        open(f, 'w', encoding='utf-8').write(t.replace('1121x', '1121y'))
        print('bumped', f)
print('patched app.js')
