/* HumanGate — shared logic: i18n, registry checker, wallet, campaigns, ID card */
const REGISTRY_MAINNET = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const APPS_TESTNET     = "0xfFF120c006ceB3487AD61943E4022e15cc8eb923"; // OneIDCampaignsV5
const BINDINGS_TESTNET = "0xC76847F54Fe3C2ca6eB61e5dd998e11Bd7e5988C"; // IdentityBindings
const BINDINGS_ABI = [
  "function registerBinding(string,bytes)",
  "function removeBinding()",
  "function bindingOf(address) view returns (string,bytes,uint64)",
  "function isBindingValid(address) view returns (bool)"
];
const SAMPLE_HOLDER    = "0x119B2Bf71856155b234f818476ae0610634A2aB9"; // 9nosing.ai
const ERC721_ABI = ["function balanceOf(address) view returns (uint256)"];
const APPS_ABI = [
  "function campaignCount() view returns (uint256)",
  "function getEntries(uint256) view returns (address[])",
  "function getWinners(uint256) view returns (address[])",
  "function getCampaign(uint256) view returns (tuple(address creator, uint8 kind, string title, uint64 startAt, uint64 endAt, uint32 winnerCount, uint64 seedBlock, bool drawn, bool usedFallbackSeed, uint8 optionCount, uint256 entryCount, address prizeToken, uint256 prizePerWinner, uint256 pool, uint256 claimAmount, uint32 maxClaims, bool claimRandom, uint256 paidOut, bool reclaimed))",
  "function hasEntered(uint256, address) view returns (bool)","function voteOf(uint256,address) view returns (uint8)",
  "function tally(uint256, uint8) view returns (uint256)",
  "function getWinners(uint256) view returns (address[])",
  "function isWinner(uint256, address) view returns (bool)",
  "function prizeClaimed(uint256, address) view returns (bool)",
  "function enterRaffle(uint256)",
  "function castVote(uint256, uint8)",
  "function draw(uint256)",
  "function claim(uint256)",
  "function claimPrize(uint256)",
  "function reclaim(uint256)",
  "function createRaffle(string, uint64, uint64, uint32, uint64, address, uint256) payable returns (uint256)",
  "function createVote(string, uint64, uint64, uint8) returns (uint256)",
  "function createClaim(string, uint64, uint64, uint32, address, uint256, bool) payable returns (uint256)",
  "function postUrl(uint256) view returns (string)","function series(uint256) view returns (string)","function setSeries(uint256,string)",
  "function setPostUrl(uint256, string)",
  "event PostUrlSet(uint256 indexed id, string url)",
  "event CampaignCreated(uint256 indexed id, address indexed creator, uint8 kind, string title, uint64 startAt, uint64 endAt)",
  "event Entered(uint256 indexed id, address indexed participant)",
  "event Voted(uint256 indexed id, address indexed participant, uint8 option)",
  "event Drawn(uint256 indexed id, uint256 seed, bool usedFallbackSeed, uint256 winnerCount)",
  "event Funded(uint256 indexed id, address token, uint256 total)",
  "event Claimed(uint256 indexed id, address indexed participant, uint256 amount)",
  "event PrizeClaimed(uint256 indexed id, address indexed winner, uint256 amount)",
  "event Reclaimed(uint256 indexed id, address indexed creator, uint256 amount)"
];
const SITE_URL = "https://sijiu94-ship-it.github.io/humangate/";
/* Network config — mainnet launch changes ONLY this block plus the APPS
   address above, TOKEN_PRESETS and SITE_URL. */
const NETWORK = {
  appsChainId: 97, appsChainHex: "0x61",
  appsRpcs: ["https://bsc-testnet-rpc.publicnode.com", "https://bsc-testnet-dataseed.bnbchain.org", "https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
  mainRpcs: ["https://bsc-dataseed.binance.org", "https://bsc-dataseed1.bnbchain.org", "https://bsc-dataseed2.bnbchain.org"],
};
const APPS_DEPLOY_BLOCK = 143989951; // V5 deployment block: event scans start here
// Token presets. Testnet addresses verified on-chain (symbol/decimals read
// 2026-11-21). Mainnet switch on 2026-11-26: USDT 0x55d398326f99059fF775485246999027B3197955,
// USDC 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d (both 18 decimals on BSC).
const TOKEN_PRESETS = {
  usdt: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  usdc: "0x64544969ed7EBf5f083679233325356EbE738930"
};
const ERC20_ABI = [
  "function approve(address, uint256) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const I18N = {
en: {
  nav_campaigns:"Campaigns", nav_how:"How it works", nav_builders:"Builders", nav_card:"ID Card",
  connect:"Connect wallet",
  kick_home:"Agent ID · BNB Chain · Sybil Resistance",
  h1a:"One human.", h1b:"One", h1c:"entry.",
  hero_sub:"Raffles and votes where every entry is backed by <b>exactly one KYC-anchored human</b> — not one wallet, not one botnet. HumanGate reads Binance <b>Agent ID</b> on-chain and lets only verified humans through. The second address simply doesn't pass.",
  hero_note:"One person, one entry — enforced by structure, not by rules.",
  check_label:"Check any address against the live Agent ID registry (BNB mainnet)",
  check_btn:"Is human?",
  check_try:"Try a known holder:", check_try_link:"9nosing.ai's wallet", check_try2:"— or paste your own Agentic Wallet address.",
  stat_campaigns:"campaigns on testnet", stat_entries:"verified-human entries",
  stat_per:"Agent IDs per human — structural, not policy", stat_funds:"funds held by the contracts, ever",
  t1_no:"01 / Campaigns", t1_h:"Enter with your one ID", t1_p:"Live raffles and votes gated by HumanGate. One Agent ID, one entry — duplicates and second wallets are rejected on-chain.", t_go:"Open →",
  t2_no:"02 / How it works", t2_h:"Two questions, two keys", t2_p:"Why the gate is stateless, why dedup belongs to each campaign, and the three things HumanGate will never do.", t_go2:"Read →",
  t3_no:"03 / Builders", t3_h:"One read call is the API", t3_p:"Contract addresses, the integration snippet, and the is-human skill any AI agent can run before it acts.", t_go3:"Build →",
  foot_l:"HumanGate — built for the Binance Wallet × BNB Chain Agent ID Hackathon. The contracts never hold funds. Prizes are paid by campaign creators; the chain only proves who entered and who won.",
  foot_r:"testnet demo · mainnet launch follows the hackathon schedule",
  v_invalid_t:"INVALID", v_invalid:"That is not a wallet address.",
  v_reading:"Reading the registry…",
  v_yes_t:"UNIQUE HUMAN", v_yes:"Holds an Agent ID — exactly one KYC-anchored human is behind this address.",
  v_yes_s:"Uniqueness is proven. Trustworthiness is not — that part is still on you.",
  v_no_t:"NOT VERIFIED", v_no:"No Agent ID at this address — it cannot pass the gate.",
  v_no_s:"Agent IDs live in the Agentic Wallet. Check you pasted that address, not your main wallet.",
  v_err_t:"ERROR", v_err:"Registry read failed — try again in a moment.",
  // campaigns page
  kick_camp:"Live on BNB testnet",
  h_camp:"Campaigns",
  camp_sub:"Every entry below passed the HumanGate check. Testnet runs on a mock registry — on mainnet, the same contracts read the real Agent ID registry and any holder can enter.",
  loading:"Loading campaigns from chain…", load_fail:"Could not reach the testnet right now — refresh in a moment.", no_camp:"No campaigns yet.",
  c_raffle:"Raffle", c_vote:"Vote", c_live:"Live", c_ended:"Ended", c_upcoming:"Upcoming", c_drawn:"Drawn",
  c_window:"Window", c_winners:"Winners", c_seed:"Seed block", c_options:"Options", c_onevote:"one ID, one vote",
  c_entries:"verified entries", c_winner:"Winner:", c_enter:"Enter raffle", c_draw:"Draw now",
  c_opt:"Option", c_vote_btn:"Vote",
  m_connect_first:"Connect your wallet first (top right). The testnet demo uses the mock registry.",
  m_signing:"Waiting for signature…", m_done:"Done — refreshing…",
  m_nowallet:"No wallet found — open this page in a wallet browser or install MetaMask.",
  m_connected:"Connected on BSC testnet: ", m_rejected:"Connection rejected or failed.", m_wrongnet:"Connected, but your wallet is not on BSC testnet - switch to BSC testnet before joining a campaign.", m_pending:"Your wallet already has a pending request - open the wallet and confirm it first.", m_disconnected:"Disconnected.", nav_disconnect:"Click to disconnect",
  // how page
  kick_how:"The design", h_how:"Two questions. Two keys.",
  how_sub:"Sybil resistance is two different questions. Most systems mash them into one database and one admin key. We keep them apart — that separation is the whole design.",
  q1_k:"Question 1 — asked on every call", q1_h:"“Is a unique human behind this address?”",
  q1_p:"Keyed by <code>address</code>. Answered by the HumanGate primitive: a single read of the Agent ID registry, <code>isHuman(address) → bool</code>. Stateless, read-only, no owner, non-upgradeable. Deployed once, never touched again — anyone can verify that on-chain.",
  q1_who:"Answered by →", q1_who_b:"HumanGate (the primitive)",
  q2_k:"Question 2 — asked once per campaign", q2_h:"“Has this human already been counted here?”",
  q2_p:"Keyed by <code>Agent ID</code>. Answered by each campaign's own bookkeeping — the state lives with the caller, not in the primitive. Because an Agent ID is non-transferable and lives in exactly one wallet, per-campaign dedup by the holding address is dedup by the ID itself.",
  q2_who:"Answered by →", q2_who_b:"each campaign contract (the caller)",
  bounds_h:"Three lines we won't cross",
  b1_x:"NEVER — 01", b1_h:"No reverse lookup", b1_p:"We answer address → human?, never name → wallet. A gate is not a surveillance tool, and we won't build one.",
  b2_x:"NEVER — 02", b2_h:"No character judgement", b2_p:"An Agent ID proves “same unique person”, never “trustworthy person”. Accountable is not the same as trusted.",
  b3_x:"NEVER — 03", b3_h:"No sybil hunting", b3_p:"We don't cluster, score or expose anyone's other addresses. Extra addresses simply don't pass the gate. That's enough.",
  why_h:"Why a primitive, not a platform",
  why_p:"Platforms hold your data and ask to be trusted. A primitive holds nothing: no database, no admin key, no off switch. Ptah's Proof of Agent draws and a wave of one-per-person mints already check the Agent ID registry by hand — HumanGate turns that proven pattern into one call any contract, and any agent, can reuse.",
  // builders page
  kick_build:"Integration", h_build:"For builders",
  build_sub:"One read call is the whole integration. If your contract can call a view function, you have sybil resistance.",
  code_note:"Gate any function with one line. The primitive is stateless — your contract keeps its own per-campaign dedup, keyed by the human.",
  a_gate:"HumanGate — BSC testnet", a_apps:"OneIDCampaigns — BSC testnet", a_bind:"IdentityBindings (testnet)", a_reg:"Agent ID registry — BSC mainnet", a_skill:"Agent skill",
  a_skill_v:"is-human — a zero-dependency checker any AI agent can run before it acts. Source in the project repo.",
  skill_h:"For agents, not just contracts",
  skill_p:"The same check ships as a skill: an AI agent about to enter, claim or pay can ask “is a unique human behind this address?” and get an answer whose evidence is on-chain — not issued by us, not stored by us.",
  // card page
  kick_card:"Read-only identity", h_card:"The ID card",
  card_sub:"What a verified human looks like on the other side of the gate. Generated from chain state in your browser — nothing is stored, nothing is tracked.",
  card_btn:"Generate", card_lbl:"HUMANGATE · IDENTITY CARD", card_not:"NOT CHECKED", card_reading:"READING…", card_fail:"READ FAILED",
  card_yes:"✓ UNIQUE HUMAN", card_no:"NO AGENT ID",
  card_note0:"Enter an address to read its Agent ID status from the BNB mainnet registry. This card proves uniqueness and continuity — the same one person, only one of them. It says nothing about whether that person is trustworthy.",
  card_note_yes:"This address holds an Agent ID on BNB Chain: one verified human, one identity, non-transferable and bound to a single Agentic Wallet. It can be counted exactly once in any HumanGate campaign — here, and everywhere the gate is used.",
  card_note_no:"No Agent ID is bound to this address. It may be a regular wallet, or the wrong address — Agent IDs live in the Agentic Wallet created inside the Binance app.",
  card_invalid:"Not a valid address",
  nav_create:"Create",
  nav_mine:"Mine",
  share_btn:"Share", c_option:"Option", m_draw:"Draw now", m_drawn:"Drawn", tx_fail:"Transaction failed", post_btn:"Creator's post", post_set:"X post link", post_ph:"Paste the post URL (https://x.com/...)", post_save:"Save link", f_posturl:"Your X post link (optional — can add later)",
  nav_bind:"Bind X",
  flt_search_ph:"Search campaigns…", flt_all:"All", flt_live:"Live", flt_upcoming:"Upcoming", flt_ended:"Ended",
  d_details:"Details", d_participants:"Participants", d_winners:"Winners", d_back:"All campaigns",
  d_proof_h:"Draw proof — verify it yourself", d_proof_seed:"Seed (from the Drawn event)", d_proof_seedblock:"Seed block",
  d_proof_fallback:"Fallback seed used (original seed block aged out)", d_proof_verify:"Recompute winners",
  d_proof_ok:"Recomputed winners match the on-chain winners exactly.", d_proof_bad:"Mismatch — do not trust this draw.",
  d_proof_how:"Winners are picked by a partial Fisher–Yates shuffle: for each slot i, j = i + keccak256(seed, i) mod (n − i) over the entry list, in entry order. Anyone can redo this math.",
  d_notdrawn:"Not drawn yet — the draw can be triggered by anyone after the end time.",
  bind_kick:"Social binding", bind_h:"Bind your X account",
  bind_sub:"A public, verifiable statement — not a trust score. It proves this X account and this wallet are the same person, nothing more. The tweet itself is the record; there is no database and no way to look anyone up by name.",
  bind_handle_ph:"Your X handle (without @)", bind_make:"Sign the binding statement",
  bind_stmt:"Statement", bind_sig:"Signature", bind_tweet:"Post this on X", bind_post:"Post on X",
  bind_verify_h:"Verify a binding", bind_verify_btn:"Verify",
  bind_addr_ph:"Wallet address 0x…", bind_sig_ph:"Signature 0x…",
  bind_ok:"Signature valid — this address signed for @{h}.", bind_ok_human:"And the address holds an Agent ID: a verified unique human.",
  bind_not_human:"Signature valid, but this address holds no Agent ID.", bind_bad:"Invalid — the signature does not match this handle and address.",
    ms_created: "Created",
    ms_participated: "Participations",
    ms_won: "Wins",
    ms_profile: "View my public profile",
    ms_human: "Verified human \u2713",
    nav_learn: "Learn",
    card_bind_h: "X account binding",
    card_bind_none: "No X account bound yet",
    card_bind_go: "Bind / manage binding",
    c_entered: "Entered",
    c_you_won: "You won",
    c_voted: "Voted",
    c_claimed_done: "Claimed",
    nav_human: "Verified unique human (Agent ID holder)",
    f_sec1: "1 \u00b7 Basics",
    f_sec2: "2 \u00b7 Prize & slots",
    f_sec3: "3 \u00b7 Promotion (optional)",
    f_preview: "Preview",
    e_title: "Give the campaign a title.",
    e_window: "End time must be after the start time and in the future.",
    e_winners: "Winner count must be at least 1.",
    e_token: "Enter a valid ERC20 token address.",
    e_prize: "Per-winner prize must be greater than 0.",
    e_options: "Options must be between 2 and 16.",
    e_pool: "Pool amount must be greater than 0.",
    e_claims: "Claim slots must be at least 1.",
    e_dust: "Pool per slot is dust \u2014 increase the pool or reduce slots.",
    d_escrow: "Prize escrowed in the contract \u2014 winners claim it themselves",
    d_escrow_no: "No prize escrow in this campaign",
    d_contract: "Contract",
    hero_cta_join: "Join a campaign",
    hero_cta_create: "Create a campaign",
    bind_bound: "Bound on-chain",
    bind_register: "Register this binding on-chain",
    bind_registered: "Binding registered \u2014 your @handle now shows on your campaigns.",
    bind_need_sig: "Generate the signature first (step 2).",
    bind_onchain: "Binding also registered on-chain",
    card_copy_link: "Copy card link",
    series_set: "Set series",
    series_ph: "Series label, e.g. Season 2",
    f_series: "Series label (optional)",
    series_all: "All series",
    poster_btn: "Make a poster",

  stat_humans:"Verified humans in", stat_payouts:"Payouts made",
  invite_btn:"Invite", invite_prompt:"Your friend's X handle (without @)?",
  invite_text:"@{friend} come join \"{title}\" on HumanGate — one Agent ID each, bot farms can\'t get in. I\'m in already:",
  discuss_btn:"Discuss on X", discuss_text:"Discussing \"{title}\" on HumanGate — one human, one entry, provably fair. #HumanGate{id}",
  card_img_btn:"Make my share card", card_img_dl:"Download PNG", card_img_share:"Post it on X",
  card_img_share_text:"I\'m a verified unique human on HumanGate — one KYC, one Agent ID, zero bots. Check your own address:",
  img_verified:"VERIFIED UNIQUE HUMAN", img_entries:"entries", img_wins:"wins", img_claims:"claims",
  creator_kick:"Creator", creator_h:"Creator page", creator_camps:"campaigns", creator_entries:"total entries",
  creator_share:"Share this creator", creator_none:"This address has not created any campaign yet.",
  creator_by:"by",

  share_text_raffle:"I just entered \"{title}\" on HumanGate — one Agent ID, one ticket. Bot farms can\'t get in, every entry is a verified unique human. Join me:",
  share_text_vote:"I just voted in \"{title}\" on HumanGate — one Agent ID, one vote, no sybil stuffing. Have your say:",
  share_text_claim:"I just claimed my share in \"{title}\" on HumanGate — one Agent ID, one share, paid on-chain instantly. Claim yours:",
  share_text_win:"I won \"{title}\" on HumanGate and claimed the prize on-chain — one Agent ID, one ticket, provably fair draw. Next one:",
  share_done_hint:"Done! Share it on X — posts with #BinanceWalletHackathon #AgenticWallet can also win the official 100 USDC community prize:",
  guide_h:"No Agent ID yet? Get one in the Binance app — about 3 minutes",
  guide_1:"Open the Binance app and go to Wallet",
  guide_2:"Tap the Agent ID banner on the wallet home page",
  guide_3:"Claim your name.ai — one KYC, one ID, free (a little BNB covers gas)",
  guide_4:"Come back here, connect the Agentic Wallet, and you are in",
  cd_ends:"ends in", cd_starts:"starts in", cd_d:"d", cd_h:"h", cd_m:"m",
  soon_h:"Ending soon", soon_sub:"Live now, closing first — do not miss the window.",
  hot_h:"Trending", hot_camps:"Hot campaigns", hot_creators:"Top creators", hot_entries:"entries",
  f_tok_usdt:"USDT (preset)", f_tok_usdc:"USDC (preset)",

  c_claim:"Claim drop", c_pool:"Pool", c_each:"Each gets", c_claimed_n:"claimed", c_claim_btn:"Claim",
  c_prize:"Prize", c_per_winner:"per winner", c_claim_prize:"Claim prize", c_prize_claimed:"Prize claimed",
  ev_claimed:"claimed a share", ev_prize:"claimed a prize",
  f_tab_claim:"Claim drop",
  f_mode:"Payout mode", f_mode_fixed:"Fixed shares", f_mode_random:"Lucky draw (random)",
  f_mode_hint:"Lucky draw uses the double-mean rule: every draw lands between a minimum and twice the remaining average, the last claimant takes the rest. Amounts are drawn from on-chain pseudo-randomness — made for fun-size pools.",
  c_lucky:"Lucky draw", c_fixed_mode:"Fixed", c_remaining:"left in pool", c_recent:"Recent draws", c_best:"Best luck",

  f_prize_token:"Prize", f_tok_none:"No prize", f_tok_bnb:"BNB", f_tok_erc20:"ERC20 token",
  f_token_addr:"Token contract address", f_per_winner:"Prize per winner", f_pool:"Total pool", f_maxclaims:"Number of shares",
  f_submit_claim:"Create claim drop",
  f_err_amount:"Amounts must be above zero.", f_err_token:"That token address is not valid.",
  f_approving:"Approving the token spend first…",
  mine_kick:"Creator console", mine_h:"My campaigns",
  mine_sub:"Campaigns you created from the connected wallet: draw them when they end, copy the winner list, reclaim what was never claimed.",
  mine_none:"Nothing here yet — this wallet has not created a campaign.", mine_connect:"Connect your wallet to see your campaigns.",
  m_copy:"Copy winners", m_copied:"Copied!", m_reclaim:"Reclaim remainder",
  rec_h:"Participation record", rec_loading:"Loading the on-chain record…",
  rec_none:"No participation found for this address yet.",
  paid_out:"Paid out",
  rec_entered:"raffles entered", rec_voted:"votes cast", rec_claimed:"shares claimed", rec_won:"raffles won",

  mq1:"One human", mq2:"One entry", mq3:"No reverse lookup", mq4:"No character judgement", mq5:"Stateless · Read-only · No owner", mq6:"Sybil resistance as a primitive",
  feed_h:"Live from the gate — BSC testnet", feed_blk:"block",
  ev_created:"campaign created", ev_entered:"entered raffle", ev_voted:"voted", ev_drawn:"raffle drawn",
  feed_empty:"No events yet in the recent window.", feed_fail:"Feed unavailable right now.",
  cta_h:"Run your own draw — gated by real humans",
  cta_p:"Anyone can create a raffle or vote here. Entries are checked against Agent ID on-chain: one human, one entry, no bot farms. You bring the prize and the crowd; the gate brings the fairness.",
  cta_btn:"Create a campaign",
  kick_create:"Open to everyone", h_create:"Create a campaign",
  create_sub:"No permission needed, no listing fee, the contract never touches your prize. Set it up, share the link, and every entry is verified against Agent ID automatically.",
  f_title:"Title", f_title_ph:"e.g. Community airdrop draw — 20 USDC",
  f_start:"Starts at", f_end:"Ends at", f_winners:"Number of winners",
  f_options:"Number of options (2–16)",
  f_seed_hint:"The draw's seed block is fixed automatically at creation — a future block right after the end time, whose hash nobody can know in advance. Results are reproducible by anyone.",
  f_prize_hint:"Prizes are paid by you directly to the winners after the draw. The contract never holds funds.",
  f_submit_raffle:"Create raffle", f_submit_vote:"Create vote",
  f_tab_raffle:"Raffle", f_tab_vote:"Vote",
  f_err_title:"Give the campaign a title.", f_err_time:"End time must be after the start time, and the start cannot be in the past.",
  f_err_winners:"Winners must be at least 1.",
  f_ok:"Campaign created — it's live on the Campaigns page now. Share it!",
  f_creating:"Creating on-chain…",
},
zh: {
  nav_campaigns:"活动", nav_how:"原理", nav_builders:"开发者", nav_card:"身份卡",
  connect:"连接钱包",
  kick_home:"Agent ID · BNB 链 · 抗女巫",
  h1a:"一个真人。", h1b:"一张", h1c:"票。",
  hero_sub:"在这里，每一次报名背后都站着<b>恰好一个经过 KYC 锚定的真人</b>——不是一个钱包，更不是一群机器人。HumanGate 在链上读取币安 <b>Agent ID</b>，只放行已验证的真人。第二个地址，就是过不去。",
  hero_note:"一人一票——不是规则定的，是结构定的。",
  check_label:"用主网真实 Agent ID 注册表，查任意地址",
  check_btn:"是真人吗？",
  check_try:"试试已知持有者：", check_try_link:"9nosing.ai 的钱包", check_try2:"——也可以粘贴你自己的 Agentic Wallet 地址。",
  stat_campaigns:"测试网上的活动", stat_entries:"真人报名人次",
  stat_per:"每个真人可领的 Agent ID——结构决定，非规则", stat_funds:"合约经手的资金，永远为零",
  t1_no:"01 / 活动", t1_h:"用你的唯一 ID 报名", t1_p:"正在进行的抽奖与投票，全部由 HumanGate 把关。一个 Agent ID 一张票——重复报名和第二个钱包都会在链上被拒。", t_go:"进入 →",
  t2_no:"02 / 原理", t2_h:"两个问题，两把钥匙", t2_p:"为什么门禁本身无状态、为什么去重状态归每个活动自己管，以及 HumanGate 永远不会做的三件事。", t_go2:"查看 →",
  t3_no:"03 / 开发者", t3_h:"一次只读调用就是 API", t3_p:"合约地址、接入代码片段，以及任何 AI Agent 动手前都能先跑一遍的 is-human 技能。", t_go3:"接入 →",
  foot_l:"HumanGate——为币安钱包 × BNB 链 Agent ID 黑客松而建。合约从不经手资金：奖品由活动发起方发放，链只负责证明谁报了名、谁中了奖。",
  foot_r:"测试网演示 · 主网按黑客松排期上线",
  v_invalid_t:"无效", v_invalid:"这不是一个钱包地址。",
  v_reading:"正在读取注册表…",
  v_yes_t:"唯一真人", v_yes:"持有 Agent ID——这个地址背后恰好站着一个 KYC 锚定的真人。",
  v_yes_s:"唯一性已证明。可不可信，仍然要你自己判断。",
  v_no_t:"未验证", v_no:"这个地址没有 Agent ID——过不了这道门。",
  v_no_s:"Agent ID 在 Agentic Wallet 里。确认你粘贴的是那个地址，而不是主钱包。",
  v_err_t:"出错", v_err:"注册表读取失败——稍等片刻再试。",
  kick_camp:"BNB 测试网运行中",
  h_camp:"活动",
  camp_sub:"下面每一次报名都通过了 HumanGate 的核验。测试网用的是模拟注册表；主网上线后，同一套合约读取真实 Agent ID 注册表，任何持有者都能报名。",
  loading:"正在从链上加载活动…", load_fail:"暂时连不上测试网——稍后刷新。", no_camp:"暂无活动。",
  c_raffle:"抽奖", c_vote:"投票", c_live:"进行中", c_ended:"已结束", c_upcoming:"未开始", c_drawn:"已开奖",
  c_window:"时间", c_winners:"中奖名额", c_seed:"种子区块", c_options:"选项数", c_onevote:"一 ID 一票",
  c_entries:"人已报名", c_winner:"中奖者：", c_enter:"报名抽奖", c_draw:"立即开奖",
  c_opt:"选项", c_vote_btn:"投",
  m_connect_first:"先连接钱包（右上角）。测试网演示使用模拟注册表。",
  m_signing:"等待签名…", m_done:"完成——刷新中…",
  m_nowallet:"没找到钱包——请在钱包浏览器里打开本页，或安装 MetaMask。",
  m_connected:"已在 BSC 测试网连接：", m_rejected:"连接被拒绝或失败。", m_wrongnet:"已连接，但钱包不在 BSC 测试网——参加活动前请先切换到 BSC 测试网。", m_pending:"钱包里已有一个待确认的请求——请先打开钱包把它处理掉。", m_disconnected:"已断开连接。", nav_disconnect:"点击断开连接",
  kick_how:"设计", h_how:"两个问题。两把钥匙。",
  how_sub:"抗女巫其实是两个不同的问题。多数系统把它们塞进同一个数据库、同一把管理员钥匙。我们把它们彻底分开——这个分离，就是全部设计。",
  q1_k:"问题一——每次调用都要问", q1_h:"「这个地址背后，是不是一个唯一真人？」",
  q1_p:"用 <code>地址</code> 作钥匙。由 HumanGate 原语回答：对 Agent ID 注册表做一次只读查询，<code>isHuman(address) → bool</code>。无状态、只读、无 owner、不可升级。部署一次，永不再动——任何人都能在链上验证这一点。",
  q1_who:"回答者 →", q1_who_b:"HumanGate（原语）",
  q2_k:"问题二——每个活动只问一次", q2_h:"「这个人，在这个活动里算过没有？」",
  q2_p:"用 <code>Agent ID</code> 作钥匙。由每个活动自己的账本回答——状态归调用方，不进原语。因为 Agent ID 不可转让、只存在于一个钱包里，按持有地址去重，就等于按 ID 本人去重。",
  q2_who:"回答者 →", q2_who_b:"每个活动合约（调用方）",
  bounds_h:"三条线，我们不越",
  b1_x:"绝不 — 01", b1_h:"不做反查", b1_p:"我们回答「地址 → 是不是真人」，绝不回答「名字 → 钱包」。门是用来把关的，不是用来监视的。",
  b2_x:"绝不 — 02", b2_h:"不判人品", b2_p:"Agent ID 证明的是「同一个人、且只有一个」，不是「这个人可信」。可问责，不等于可信。",
  b3_x:"绝不 — 03", b3_h:"不查小号", b3_p:"我们不聚类、不打分、不曝光任何人的其他地址。多余的地址过不了门——这就够了。",
  why_h:"为什么是原语，不是平台",
  why_p:"平台握着你的数据，要求你信任它。原语什么都不握：没有数据库、没有管理员钥匙、没有关停开关。Ptah 的 Proof of Agent 抽奖和一批「一人一份」的 Mint 已经在手工查 Agent ID 注册表了——HumanGate 把这个被验证过的模式，做成任何合约、任何 Agent 都能复用的一次调用。",
  kick_build:"接入", h_build:"开发者",
  build_sub:"一次只读调用，就是全部接入工作。你的合约只要能调 view 函数，就拥有了抗女巫能力。",
  code_note:"一行代码给任何函数加门。原语无状态——去重状态由你的合约按「人」自己记。",
  a_gate:"HumanGate — BSC 测试网", a_apps:"OneIDCampaigns — BSC 测试网", a_bind:"绑定登记合约（测试网）", a_reg:"Agent ID 注册表 — BSC 主网", a_skill:"Agent 技能",
  a_skill_v:"is-human——零依赖的小工具，任何 AI Agent 在动手之前都能先跑一遍。源码在项目仓库里。",
  skill_h:"不只给合约，也给 Agent",
  skill_p:"同一套核验也做成了技能：AI Agent 在报名、领取或付款之前，可以先问一句「这个地址背后是不是唯一真人？」——答案的证据在链上，不由我们签发，也不经我们存储。",
  kick_card:"只读身份", h_card:"身份卡",
  card_sub:"一个已验证真人，在门的另一侧长什么样。由你的浏览器直接读链生成——不存储、不追踪。",
  card_btn:"生成", card_lbl:"HUMANGATE · 身份卡", card_not:"未查询", card_reading:"读取中…", card_fail:"读取失败",
  card_yes:"✓ 唯一真人", card_no:"无 AGENT ID",
  card_note0:"输入地址，从 BNB 主网注册表读取它的 Agent ID 状态。这张卡证明唯一性与连续性——同一个人、且只有一个。它不说明这个人是否可信。",
  card_note_yes:"这个地址在 BNB 链上持有 Agent ID：一个已验证真人、一个身份，不可转让、只绑定一个 Agentic Wallet。在任何接入 HumanGate 的活动里，它都只能被计算一次——在这里如此，在所有用这道门的地方都如此。",
  card_note_no:"这个地址没有绑定 Agent ID。它可能只是个普通钱包，或者地址贴错了——Agent ID 在币安 App 里创建的 Agentic Wallet 里。",
  card_invalid:"这不是有效的地址",
  nav_create:"发布活动",
  nav_mine:"我的活动",
  share_btn:"分享", c_option:"选项", m_draw:"立即开奖", m_drawn:"已开奖", tx_fail:"交易失败", post_btn:"发行人的帖子", post_set:"X 帖子链接", post_ph:"粘贴帖子链接（https://x.com/…）", post_save:"保存链接", f_posturl:"你的 X 帖子链接（选填，可稍后补）",
  nav_bind:"绑定 X",
  flt_search_ph:"搜索活动…", flt_all:"全部", flt_live:"进行中", flt_upcoming:"未开始", flt_ended:"已结束",
  d_details:"详情", d_participants:"参与者", d_winners:"中奖名单", d_back:"全部活动",
  d_proof_h:"开奖证明 — 自己验一遍", d_proof_seed:"种子（来自 Drawn 事件）", d_proof_seedblock:"种子区块",
  d_proof_fallback:"用了备用种子（原种子区块已过期）", d_proof_verify:"复算中奖名单",
  d_proof_ok:"复算结果与链上中奖名单完全一致。", d_proof_bad:"对不上——这次开奖不可信。",
  d_proof_how:"中奖者由部分 Fisher–Yates 洗牌决定：第 i 个名额 j = i + keccak256(种子, i) 对 (n − i) 取模，按报名顺序在名单上换位。任何人都能重算这笔账。",
  d_notdrawn:"尚未开奖——结束时间过后，任何人都能触发开奖。",
  bind_kick:"社交绑定", bind_h:"绑定你的 X 账号",
  bind_sub:"一份公开可验的声明——不是信誉分。它只证明这个 X 账号和这个钱包是同一个人，仅此而已。推文本身就是记录；没有数据库，也不能拿名字反查任何人。",
  bind_handle_ph:"你的 X 账号（不带 @）", bind_make:"签名生成绑定声明",
  bind_stmt:"声明原文", bind_sig:"签名", bind_tweet:"把这段发到 X 上", bind_post:"发到 X",
  bind_verify_h:"验证一份绑定", bind_verify_btn:"验证",
  bind_addr_ph:"钱包地址 0x…", bind_sig_ph:"签名 0x…",
  bind_ok:"签名有效——这个地址确实为 @{h} 签了名。", bind_ok_human:"且该地址持有 Agent ID：已验证的唯一真人。",
  bind_not_human:"签名有效，但这个地址没有 Agent ID。", bind_bad:"无效——签名与这个账号、地址对不上。",
    ms_created: "\u53d1\u884c",
    ms_participated: "\u53c2\u52a0",
    ms_won: "\u4e2d\u5956",
    ms_profile: "\u67e5\u770b\u6211\u7684\u516c\u5f00\u4e3b\u9875",
    ms_human: "\u771f\u4eba \u2713",
    nav_learn: "\u4e86\u89e3",
    card_bind_h: "X \u8d26\u53f7\u7ed1\u5b9a",
    card_bind_none: "\u5c1a\u672a\u7ed1\u5b9a X \u8d26\u53f7",
    card_bind_go: "\u53bb\u7ed1\u5b9a / \u7ba1\u7406\u7ed1\u5b9a",
    c_entered: "\u5df2\u53c2\u52a0",
    c_you_won: "\u4f60\u4e2d\u5956\u4e86",
    c_voted: "\u5df2\u6295\u7968",
    c_claimed_done: "\u5df2\u9886\u53d6",
    nav_human: "\u5df2\u9a8c\u8bc1\u771f\u4eba\uff08Agent ID \u6301\u6709\u8005\uff09",
    f_sec1: "1 \u00b7 \u57fa\u672c\u4fe1\u606f",
    f_sec2: "2 \u00b7 \u5956\u54c1\u4e0e\u540d\u989d",
    f_sec3: "3 \u00b7 \u63a8\u5e7f\uff08\u53ef\u9009\uff09",
    f_preview: "\u9884\u89c8",
    e_title: "\u8bf7\u586b\u5199\u6d3b\u52a8\u6807\u9898\u3002",
    e_window: "\u7ed3\u675f\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4\u3001\u4e14\u5728\u672a\u6765\u3002",
    e_winners: "\u4e2d\u5956\u4eba\u6570\u81f3\u5c11\u4e3a 1\u3002",
    e_token: "\u8bf7\u586b\u5199\u6709\u6548\u7684 ERC20 \u4ee3\u5e01\u5730\u5740\u3002",
    e_prize: "\u6bcf\u4efd\u5956\u54c1\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\u3002",
    e_options: "\u9009\u9879\u6570\u91cf\u987b\u5728 2 \u5230 16 \u4e4b\u95f4\u3002",
    e_pool: "\u5956\u6c60\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\u3002",
    e_claims: "\u9886\u53d6\u4efd\u6570\u81f3\u5c11\u4e3a 1\u3002",
    e_dust: "\u5e73\u5747\u6bcf\u4efd\u91d1\u989d\u592a\u5c0f\u2014\u2014\u8bf7\u52a0\u5927\u5956\u6c60\u6216\u51cf\u5c11\u4efd\u6570\u3002",
    d_escrow: "\u5956\u91d1\u7531\u5408\u7ea6\u6258\u7ba1 \u00b7 \u4e2d\u5956\u8005\u81ea\u52a9\u9886\u53d6",
    d_escrow_no: "\u672c\u6d3b\u52a8\u65e0\u5956\u91d1\u6258\u7ba1",
    d_contract: "\u5408\u7ea6",
    hero_cta_join: "\u53c2\u52a0\u6d3b\u52a8",
    hero_cta_create: "\u521b\u5efa\u6d3b\u52a8",
    bind_bound: "\u5df2\u94fe\u4e0a\u7ed1\u5b9a",
    bind_register: "\u628a\u7ed1\u5b9a\u767b\u8bb0\u5230\u94fe\u4e0a",
    bind_registered: "\u767b\u8bb0\u6210\u529f\u2014\u2014\u4f60\u7684\u6d3b\u52a8\u5361\u7247\u4e0a\u4f1a\u663e\u793a @\u8d26\u53f7\u4e86\u3002",
    bind_need_sig: "\u5148\u5728\u7b2c\u4e8c\u6b65\u751f\u6210\u7b7e\u540d\u3002",
    bind_onchain: "\u8be5\u7ed1\u5b9a\u5df2\u5728\u94fe\u4e0a\u767b\u8bb0",
    card_copy_link: "\u590d\u5236\u540d\u7247\u94fe\u63a5",
    series_set: "\u8bbe\u7f6e\u7cfb\u5217",
    series_ph: "\u7cfb\u5217\u6807\u7b7e\uff0c\u5982\uff1a\u7b2c\u4e8c\u671f",
    f_series: "\u7cfb\u5217\u6807\u7b7e\uff08\u9009\u586b\uff09",
    series_all: "\u5168\u90e8\u7cfb\u5217",
    poster_btn: "\u751f\u6210\u6d77\u62a5",

  stat_humans:"已验证真人", stat_payouts:"已发放笔数",
  invite_btn:"邀请", invite_prompt:"朋友的 X 账号（不带 @）？",
  invite_text:"@{friend} 来参加 HumanGate 的《{title}》——一人一个 Agent ID，机器人农场进不来。我已经参加了：",
  discuss_btn:"去 X 讨论", discuss_text:"聊聊 HumanGate 的《{title}》——一人一票、开奖可复算。#HumanGate{id}",
  card_img_btn:"生成我的晒卡", card_img_dl:"下载 PNG", card_img_share:"发推晒卡",
  card_img_share_text:"我在 HumanGate 已验证为唯一真人——一个 KYC、一个 Agent ID、零机器人。查查你自己的地址：",
  img_verified:"已验证 · 唯一真人", img_entries:"参与", img_wins:"中奖", img_claims:"领取",
  creator_kick:"创作者", creator_h:"创作者主页", creator_camps:"个活动", creator_entries:"总参与人次",
  creator_share:"分享这位创作者", creator_none:"这个地址还没有发起过活动。",
  creator_by:"发起人",

  share_text_raffle:"我刚在 HumanGate 参加了《{title}》——一人一个 Agent ID、一张票，机器人农场进不来，每个名额都是验证过的真人。一起来：",
  share_text_vote:"我刚在 HumanGate 的《{title}》投了一票——一个 Agent ID 一票，女巫刷不了票。你也来表个态：",
  share_text_claim:"我刚在 HumanGate 的《{title}》领到了我那一份——一个 Agent ID 一份，链上即时到账。你也来领：",
  share_text_win:"我在 HumanGate 的《{title}》中奖了，奖品已在链上领到——一人一票、开奖可复算。下期一起：",
  share_done_hint:"搞定！发条推晒一下——带 #BinanceWalletHackathon #AgenticWallet 的原创推还有机会拿官方 100 USDC 社区奖：",
  guide_h:"还没有 Agent ID？去币安 App 领一个，大约 3 分钟",
  guide_1:"打开币安 App，进入钱包",
  guide_2:"点钱包首页的 Agent ID 横幅",
  guide_3:"领取你的 name.ai——一个 KYC 一个、免费（备一点点 BNB 付 gas）",
  guide_4:"回到这里，连接 Agentic Wallet，就能参加了",
  cd_ends:"距结束", cd_starts:"距开始", cd_d:"天", cd_h:"小时", cd_m:"分",
  soon_h:"即将结束", soon_sub:"正在进行、先到截止时间的排前面——别错过窗口。",
  hot_h:"热度榜", hot_camps:"热门活动", hot_creators:"创作者榜", hot_entries:"人参与",
  f_tok_usdt:"USDT（预设）", f_tok_usdc:"USDC（预设）",

  c_claim:"领取", c_pool:"奖池", c_each:"每份", c_claimed_n:"已领", c_claim_btn:"领取",
  c_prize:"奖品", c_per_winner:"每位中奖者", c_claim_prize:"领取奖品", c_prize_claimed:"奖品已领取",
  ev_claimed:"领取了一份", ev_prize:"领取了奖品",
  f_tab_claim:"领取活动",
  f_mode:"发放方式", f_mode_fixed:"固定金额", f_mode_random:"拼手气（随机）",
  f_mode_hint:"拼手气用二倍均值法：每次领取在保底和剩余平均值两倍之间随机，最后一位拿走剩余。金额由链上伪随机决定——适合小额娱乐局。",
  c_lucky:"拼手气", c_fixed_mode:"固定", c_remaining:"奖池剩余", c_recent:"领取记录", c_best:"手气最佳",

  f_prize_token:"奖品", f_tok_none:"无奖品", f_tok_bnb:"BNB", f_tok_erc20:"ERC20 代币",
  f_token_addr:"代币合约地址", f_per_winner:"每位中奖者奖品", f_pool:"奖池总额", f_maxclaims:"份数",
  f_submit_claim:"创建领取活动",
  f_err_amount:"金额必须大于零。", f_err_token:"代币地址不对。",
  f_approving:"先授权代币额度…",
  mine_kick:"创作者控制台", mine_h:"我发起的活动",
  mine_sub:"用当前连接的钱包发起的活动都在这里：到点开奖、复制中奖名单、回收没人领走的部分。",
  mine_none:"还没有——这个钱包没发起过活动。", mine_connect:"先连接钱包，才能看到你发起的活动。",
  m_copy:"复制中奖名单", m_copied:"已复制！", m_reclaim:"回收剩余",
  rec_h:"参与战绩", rec_loading:"正在读取链上记录…",
  rec_none:"这个地址还没有参与记录。",
  paid_out:"已发放",
  rec_entered:"参加抽奖", rec_voted:"参与投票", rec_claimed:"领取份额", rec_won:"中奖次数",

  mq1:"一个真人", mq2:"一张票", mq3:"不做反查", mq4:"不判人品", mq5:"无状态 · 只读 · 无所有者", mq6:"把抗女巫做成原语",
  feed_h:"门边的实时动态 — BSC 测试网", feed_blk:"区块",
  ev_created:"新建了活动", ev_entered:"报名了抽奖", ev_voted:"投了一票", ev_drawn:"抽奖已开奖",
  feed_empty:"最近还没有事件。", feed_fail:"动态暂时不可用。",
  cta_h:"办你自己的抽奖——由真人把关",
  cta_p:"任何人都能在这里发起抽奖或投票。每次报名都对照 Agent ID 在链上核验：一人一票，机器人农场进不来。你出奖品和人气，门负责公平。",
  cta_btn:"发起一个活动",
  kick_create:"对所有人开放", h_create:"发起活动",
  create_sub:"无需许可、没有上架费，合约也永不经手你的奖品。设置好、把链接发出去，每一次报名都会自动对照 Agent ID 核验。",
  f_title:"标题", f_title_ph:"例如：社区空投抽奖 — 20 USDC",
  f_start:"开始时间", f_end:"结束时间", f_winners:"中奖人数",
  f_options:"选项数量（2–16）",
  f_seed_hint:"开奖的种子区块会在创建时自动定死——取结束时间之后的一个未来区块，它的哈希无人能提前知道。开奖结果任何人可复算。",
  f_prize_hint:"奖品由你在开奖后直接发给中奖者。合约从不经手资金。",
  f_submit_raffle:"创建抽奖", f_submit_vote:"创建投票",
  f_tab_raffle:"抽奖", f_tab_vote:"投票",
  f_err_title:"给活动起个标题。", f_err_time:"结束时间必须晚于开始时间，开始时间不能是过去。",
  f_err_winners:"中奖人数至少为 1。",
  f_ok:"活动创建成功——已经出现在活动页了。快分享出去！",
  f_creating:"正在上链创建…",
}};

let LANG = localStorage.getItem("hg-lang") || ((navigator.language || "en").startsWith("zh") ? "zh" : "en");
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
window.__HG_DICTS = I18N;

function applyI18n(){
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === LANG));
  if (typeof window.__mqFill === "function") window.__mqFill();
  if (typeof window.onLangChange === "function") window.onLangChange();
}
function setLang(l){ LANG = l; localStorage.setItem("hg-lang", l); applyI18n(); }

const $ = id => document.getElementById(id);
function toast(msg){ const el = $("toast"); if(!el) return; el.textContent = msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"), 3400); }
function short(a){ return a.slice(0,6)+"…"+a.slice(-4); }
function fmtTime(ts){ const d = new Date(Number(ts)*1000); return d.toLocaleString(LANG === "zh" ? "zh-CN" : "en-GB", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"}); }

let providerMain = null, providerTest = null, registry = null, appsRead = null, bindingsRead = null;
function chain(){
  if (!providerMain){
    const fb = (urls, chainId) => new ethers.FallbackProvider(urls.map(u => new ethers.JsonRpcProvider(u, chainId, { staticNetwork: true })), chainId, { quorum: 1 });
    providerMain = fb(NETWORK.mainRpcs, 56);
    providerTest = fb(NETWORK.appsRpcs, NETWORK.appsChainId);
    registry = new ethers.Contract(REGISTRY_MAINNET, ERC721_ABI, providerMain);
    appsRead = new ethers.Contract(APPS_TESTNET, APPS_ABI, providerTest);
    bindingsRead = new ethers.Contract(BINDINGS_TESTNET, BINDINGS_ABI, providerTest);
  }
}

/* ---------- checker + card (shared read) ---------- */
async function readHuman(addr){
  chain();
  return (await registry.balanceOf(addr)) > 0n;
}
async function checkAddress(addr, verdictEl){
  if(!ethers.isAddress(addr)){ verdictEl.className = "verdict show no"; verdictEl.innerHTML = `<span class="tag">${t("v_invalid_t")}</span>${t("v_invalid")}`; return; }
  verdictEl.className = "verdict show"; verdictEl.innerHTML = t("v_reading");
  try{
    const human = await readHuman(addr);
    verdictEl.className = "verdict show " + (human ? "yes" : "no");
    verdictEl.innerHTML = human
      ? `<span class="tag">${t("v_yes_t")}</span>${t("v_yes")}<small>${t("v_yes_s")}</small>`
      : `<span class="tag">${t("v_no_t")}</span>${t("v_no")}<small>${t("v_no_s")}</small>`;
    toggleGuide(human === false);
  }catch(e){ verdictEl.className = "verdict show no"; verdictEl.innerHTML = `<span class="tag">${t("v_err_t")}</span>${t("v_err")}`; }
}

/* ---------- wallet ---------- */
let signer = null, myAddr = null;
async function connectWallet(){
  if(!window.ethereum){ toast(t("m_nowallet")); return; }
  try{
    try{ sessionStorage.removeItem("hg_dc"); }catch(e){}
    await window.ethereum.request({ method:"eth_requestAccounts" });
    const prov = new ethers.BrowserProvider(window.ethereum);
    signer = await prov.getSigner();
    myAddr = await signer.getAddress();
    try{
      const net = await prov.getNetwork();
      if(net.chainId !== BigInt(NETWORK.appsChainId)){
        try{ await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: NETWORK.appsChainHex }] }); }
        catch(swErr){
          if(swErr && swErr.code === 4902){
            await window.ethereum.request({ method:"wallet_addEthereumChain", params:[{ chainId: NETWORK.appsChainHex, chainName:"BNB Smart Chain Testnet", nativeCurrency:{ name:"tBNB", symbol:"tBNB", decimals:18 }, rpcUrls:["https://bsc-testnet-rpc.publicnode.com", "https://bsc-testnet-dataseed.bnbchain.org"], blockExplorerUrls:["https://testnet.bscscan.com"] }] });
          } else throw swErr;
        }
      }
    }catch(chainErr){ toast(t("m_wrongnet")); }
    document.querySelectorAll(".connectBtn").forEach(b => { b.textContent = short(myAddr); b.title = t("nav_disconnect"); });
    try{
      const h = await readHuman(myAddr);
      if (h) document.querySelectorAll(".connectBtn").forEach(b => { b.textContent = short(myAddr) + " \u2713"; b.title = t("nav_human") + " \u00b7 " + t("nav_disconnect"); });
    }catch(e){}
    toast(t("m_connected") + myAddr);
    if ($("campGrid")) loadCampaigns();
    if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail();
  if ($("cardBtn") && !new URLSearchParams(location.search).get("a")) { $("cardInput").value = myAddr; $("cardBtn").click(); }
  const rbb = $("registerBindBtn");
  if (rbb) rbb.onclick = async () => {
    if(!lastBind){ toast(t("bind_need_sig")); return; }
    rbb.disabled = true;
    try{
      await connectWallet();
      const bw = new ethers.Contract(BINDINGS_TESTNET, BINDINGS_ABI, signer);
      await (await bw.registerBinding(lastBind.handle, lastBind.sig)).wait();
      __bindCache[signer.address.toLowerCase()] = Promise.resolve(lastBind.handle);
      if ($("bindRegStatus")) $("bindRegStatus").textContent = t("bind_registered");
      toast(t("bind_registered"));
    }catch(e){ if ($("bindRegStatus")) $("bindRegStatus").textContent = (e.shortMessage || e.message || "").slice(0, 140); }
    rbb.disabled = false;
  };
  if ($("cardAvatar")) drawIdenticon("0x0000000000000000000000000000000000000000");
  const scb = $("makeCardBtn");
  if (scb) scb.addEventListener("click", drawShareCard);
  }catch(e){
    if(e && e.code === -32002) toast(t("m_pending"));
    else toast(t("m_rejected") + " [" + ((e && (e.shortMessage || e.message)) || "unknown").slice(0, 110) + "]");
  }
}

function disconnectWallet(){
  signer = null; myAddr = null;
  try{ sessionStorage.setItem("hg_dc", "1"); }catch(e){}
  document.querySelectorAll(".connectBtn").forEach(b => { b.textContent = t("connect"); b.title = ""; });
  toast(t("m_disconnected"));
  if ($("campGrid")) loadCampaigns();
  if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail();
}

/* ---------- countdowns ---------- */
function cdText(end){
  const s = Math.max(0, end - Math.floor(Date.now()/1000));
  const d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60);
  return (d ? d + t("cd_d") + " " : "") + (h ? h + t("cd_h") + " " : "") + m + t("cd_m");
}
function tickCountdowns(){
  document.querySelectorAll(".cd[data-end]").forEach(el => {
    const end = Number(el.dataset.end), started = Number(el.dataset.start || 0);
    const nowS = Math.floor(Date.now()/1000);
    el.textContent = nowS < started ? t("cd_starts") + " " + cdText(started) : t("cd_ends") + " " + cdText(end);
  });
}
setInterval(tickCountdowns, 30000);

/* ---------- share ---------- */
window.__campTitles = {};
window.shareCampaign = (id, won) => {
  chain();
  const title = window.__campTitles[id] || "HumanGate";
  const kind = window.__campKinds ? window.__campKinds[id] : 0;
  const key = won ? "share_text_win" : kind === 2 ? "share_text_claim" : kind === 1 ? "share_text_vote" : "share_text_raffle";
  const text = t(key).replace("{title}", title) + " " + SITE_URL + " #BinanceWalletHackathon #AgenticWallet";
  window.open("https://x.com/intent/tweet?text=" + encodeURIComponent(text), "_blank");
};
window.__campKinds = {};

/* ---------- campaigns ---------- */
function tokenLabel(addr){
  return (!addr || addr === ethers.ZeroAddress) ? "BNB" : "ERC20 " + short(addr);
}
function fmtAmt(v){ // wei bigint -> short decimal
  const s = ethers.formatEther(v);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

async function loadCampaigns(){
  const grid = $("campGrid");
  if(!grid && !$("soonGrid") && !$("statCampaigns")) return;
  chain();
  try{
    const n = Number(await appsRead.campaignCount());
    let totalEntries = 0;
    let all = [];
    if(n === 0){ if(grid) grid.innerHTML = `<div class="empty">${t("no_camp")}</div>`; }
    else{
      const order = [];
      for(let i = n-1; i >= 0; i--) order.push(i);
      const fetched = await Promise.all(order.map(i => appsRead.getCampaign(i)));
      fetched.forEach((c, pos) => { const i = order[pos]; all.push([i, c]); window.__campTitles[i] = String(c.title); window.__campKinds[i] = Number(c.kind); totalEntries += Number(c.entryCount); });
      const cards = await Promise.all(order.map(async (i, pos) => {
        const c = fetched[pos];
        const now = Math.floor(Date.now()/1000);
        const live = now >= Number(c.startAt) && now <= Number(c.endAt);
        const ended = now > Number(c.endAt);
        const isRaffle = Number(c.kind) === 0;
        let keyline = "";
        let primary = "";
        let extra = "";
        let entered = false, myWin = false;
        if(myAddr){
          try{ entered = await appsRead.hasEntered(i, myAddr); }catch(e){}
          if(c.drawn){ try{ myWin = await appsRead.isWinner(i, myAddr); }catch(e){} }
        }
        const hasPrize = isRaffle && c.prizePerWinner > 0n;
        if(isRaffle){
          keyline = hasPrize
            ? `<b>${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}</b> \u00d7 ${c.winnerCount} \u00b7 ${c.entryCount} ${t("c_entries")}`
            : `${c.winnerCount} ${t("c_winners")} \u00b7 ${c.entryCount} ${t("c_entries")}`;
          if(c.drawn){
            const w = await appsRead.getWinners(i);
            extra = `<span class="count">${t("c_winner")} <b>${w.length ? short(w[0]) : "\u2014"}</b>${w.length > 1 ? ` +${w.length - 1}` : ""}</span>`;
            if(hasPrize && myAddr && (await appsRead.isWinner(i, myAddr)) && !(await appsRead.prizeClaimed(i, myAddr))){
              primary = `<button class="cta-btn" onclick="claimPrize(${i})">${t("c_claim_prize")}</button>`;
            } else if(hasPrize && myAddr && (await appsRead.prizeClaimed(i, myAddr))){
              extra += `<span class="count">${t("c_prize_claimed")}</span>`;
            }
          } else if(live){
            primary = entered
              ? `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_entered")} \u2713</button>`
              : `<button class="cta-btn" onclick="enterRaffle(${i})">${t("c_enter")}</button>`;
          } else if(ended){
            primary = `<button class="cta-btn outline" onclick="drawCampaign(${i})">${t("c_draw")}</button>`;
          }
        } else if(Number(c.kind) === 2){
          const claimed = Number(c.entryCount), max = Number(c.maxClaims);
          keyline = c.claimRandom
            ? `<b>${fmtAmt(c.pool)} ${tokenLabel(c.prizeToken)}</b> \u00b7 ${t("c_lucky")} \u00b7 ${claimed}/${max} ${t("c_claimed_n")}`
            : `<b>${fmtAmt(c.claimAmount)} ${tokenLabel(c.prizeToken)}</b> / ${t("c_each")} \u00b7 ${claimed}/${max} ${t("c_claimed_n")}`;
          if(live && claimed < max){
            primary = entered
              ? `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_claimed_done")} \u2713</button>`
              : `<button class="cta-btn" onclick="claimShare(${i})">${t("c_claim_btn")}</button>`;
          }
        } else {
          keyline = `${c.optionCount} ${t("c_options")} \u00b7 ${c.entryCount} ${t("c_entries")}`;
          let opts = "";
          for(let o = 0; o < Number(c.optionCount); o++){
            const tv = await appsRead.tally(i, o);
            opts += `<span class="opt">${t("c_opt")} ${o+1} \u00b7 <b>${tv}</b></span>`;
          }
          extra = `<div class="tally">${opts}</div>`;
          if(live){
            if(entered){
              let myOpt = 0;
              try{ myOpt = Number(await appsRead.voteOf(i, myAddr)); }catch(e){}
              primary = `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_voted")} \u00b7 ${t("c_opt")} ${myOpt + 1} \u2713</button>`;
            } else {
              primary = `<div class="vote-row">` + Array.from({length:Number(c.optionCount)},(_,o)=>`<button class="cta-btn outline" onclick="voteCampaign(${i},${o})">${t("c_vote_btn")} ${o+1}</button>`).join("") + `</div>`;
            }
          }
        }
        let postBtn = "";
        try{
          const pu = await appsRead.postUrl(i);
          if (pu && pu.startsWith("https://")) postBtn = `<a class="btn sm ghost" href="${pu.replace(/"/g, "%22")}" target="_blank" rel="noopener">${t("post_btn")}</a>`;
        }catch(e){}
        let seriesTag = "";
        try{ seriesTag = await appsRead.series(i); }catch(e){}
        const creatorHtml = await creatorLabel(c.creator);
        return `<div class="camp${ended ? " is-ended" : ""}" data-kind="${Number(c.kind)}" data-status="${live ? "live" : ended ? "ended" : "upcoming"}" data-title="${String(c.title).replace(/"/g, "").toLowerCase()}" data-series="${seriesTag.replace(/"/g, "").toLowerCase()}" data-slabel="${seriesTag.replace(/"/g, "")}">
          <div class="camp-top">
            <span class="chip ${isRaffle ? "raffle" : ""}">${isRaffle ? t("c_raffle") : Number(c.kind) === 2 ? t("c_claim") : t("c_vote")}</span>
            <span class="chip ${live ? "live" : "ended"}">${live ? `<span class="livedot"></span>` : ""}${c.drawn ? t("c_drawn") : live ? t("c_live") : ended ? t("c_ended") : t("c_upcoming")}</span>${seriesTag ? `<span class="chip" style="color:var(--gold);border-color:rgba(240,185,11,.45)">${seriesTag.replace(/</g, "&lt;")}</span>` : ""}${myWin ? `<span class="chip" style="background:var(--gold);color:#000;border-color:var(--gold);font-weight:700">${t("c_you_won")}</span>` : entered ? `<span class="chip" style="color:var(--gold);border-color:rgba(240,185,11,.45)">${t(Number(c.kind) === 2 ? "c_claimed_done" : Number(c.kind) === 1 ? "c_voted" : "c_entered")}</span>` : ""}
          </div>
          <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
          <div class="keyline">${keyline}</div>
          <div class="creator-line">${t("creator_by")} ${creatorHtml}${live || !ended ? ` \u00b7 <span class="cd" data-start="${c.startAt}" data-end="${c.endAt}"></span>` : ` \u00b7 ${fmtTime(c.endAt)}`}</div>
          <div class="cta-zone">
            ${extra}
            ${primary}
            <span class="camp-msg" id="msg-${i}"></span>
            <div class="subrow"><button class="btn sm ghost" onclick="shareCampaign(${i})">${t("share_btn")}</button>${postBtn}<a class="btn sm ghost" href="campaign.html?id=${i}" style="text-decoration:none">${t("d_details")}</a></div>
          </div>
        </div>`;
      }));
      if(grid) grid.innerHTML = cards.join("");
      populateSeriesFilters();
    }
    if($("statCampaigns")) $("statCampaigns").textContent = n;
    if($("statEntries")) $("statEntries").textContent = totalEntries;
    renderHot(all);
    renderSoon(all);
    tickCountdowns();
  }catch(e){
    if(grid) grid.innerHTML = `<div class="empty">${t("load_fail")}</div>`;
  }
}
function renderHot(all){
  const box = $("hotBox"); if(!box) return;
  const byEntries = [...all].sort((a,b)=>Number(b[1].entryCount)-Number(a[1].entryCount)).slice(0,5);
  const creators = {};
  all.forEach(([i,c]) => { creators[c.creator] = (creators[c.creator] || 0) + Number(c.entryCount); });
  const topCreators = Object.entries(creators).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const kindName = k => k === 0 ? t("c_raffle") : k === 2 ? t("c_claim") : t("c_vote");
  box.innerHTML = `<div class="hot-grid">
    <div class="hot-col"><h4>${t("hot_camps")}</h4>${byEntries.map(([i,c],r)=>`<div class="hot-row"><span class="rank">${r+1}</span><span class="hot-title">${String(c.title).replace(/</g,"&lt;")}</span><span class="hot-n">${c.entryCount} ${t("hot_entries")}</span></div>`).join("") || `<div class="hot-row">${t("no_camp")}</div>`}</div>
    <div class="hot-col"><h4>${t("hot_creators")}</h4>${topCreators.map(([addr,n],r)=>`<div class="hot-row"><span class="rank">${r+1}</span><span class="hot-title"><a href="creator.html?a=${addr}" style="color:inherit">${short(addr)}</a></span><span class="hot-n">${n} ${t("hot_entries")}</span></div>`).join("")}</div>
  </div>`;
}
function renderSoon(all){
  const grid = $("soonGrid"); if(!grid) return;
  const nowS = Math.floor(Date.now()/1000);
  const live = all.filter(([i,c]) => nowS >= Number(c.startAt) && nowS <= Number(c.endAt)).sort((a,b)=>Number(a[1].endAt)-Number(b[1].endAt)).slice(0,3);
  grid.innerHTML = live.length ? live.map(([i,c])=>`<div class="camp">
      <div class="camp-top"><span class="chip ${Number(c.kind)===0 ? "raffle" : ""}">${Number(c.kind)===0 ? t("c_raffle") : Number(c.kind)===2 ? t("c_claim") : t("c_vote")}</span><span class="chip live">${t("c_live")}</span></div>
      <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
      <div class="meta"><span class="cd" data-start="${c.startAt}" data-end="${c.endAt}"></span> · <b>${c.entryCount}</b> ${t("c_entries")}</div>
      <div class="foot"><a class="btn sm" href="campaign.html?id=${id}" style="text-decoration:none">${t("d_details")}</a></div>
    </div>`).join("") : `<div class="empty">${t("no_camp")}</div>`;
  tickCountdowns();
}
async function withSigner(fn, id){
  const msg = $("msg-"+id);
  if(!signer){ toast(t("m_connect_first")); return; }
  try{ if(msg) msg.textContent = t("m_signing"); await fn(); if(msg) msg.innerHTML = t("m_done") + " " + t("share_done_hint") + ` <a href="#" onclick="shareCampaign(${id});return false;">X</a>`; loadCampaigns(); }
  catch(e){ if(msg) msg.textContent = (e.shortMessage || e.message || "Failed").slice(0,110); }
}
window.enterRaffle = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.enterRaffle(id)).wait(); }, id);
window.voteCampaign = (id,o) => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.castVote(id,o)).wait(); }, id);
window.drawCampaign = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.draw(id)).wait(); }, id);
window.setPostUrlMine = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const v = ($("posturl-" + id)?.value || "").trim(); await (await a.setPostUrl(id, v)).wait(); loadMine(); }, id);
window.setSeriesMine = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const v = ($("series-" + id)?.value || "").trim(); await (await a.setSeries(id, v)).wait(); loadMine(); }, id);
window.claimShare = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.claim(id)).wait(); }, id);
window.claimPrize = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.claimPrize(id)).wait(); }, id);
window.reclaimCampaign = id => withSigner(async () => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await (await a.reclaim(id)).wait(); }, id);
window.onLangChange = () => { if ($("campGrid")) loadCampaigns(); if ($("feedList")) loadFeed(); if ($("mineGrid")) loadMine(); };

/* ---------- live gate feed ---------- */
async function loadFeed(){
  const ul = $("feedList"); if(!ul) return;
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    if ($("feedBlock")) $("feedBlock").textContent = t("feed_blk") + " " + latest.toLocaleString();
    const logs = await providerTest.getLogs({ address: APPS_TESTNET, fromBlock: Math.max(0, latest - 30000), toBlock: latest });
    const iface = new ethers.Interface(APPS_ABI);
    const items = [];
    for (const log of logs.slice(-40).reverse()){
      let p; try{ p = iface.parseLog(log); }catch(e){ continue; }
      if(!p) continue;
      const when = new Date().toLocaleTimeString(LANG === "zh" ? "zh-CN" : "en-GB", {hour:"2-digit", minute:"2-digit"});
      if (p.name === "CampaignCreated") items.push(`<li><span class="ev">${t("ev_created")}</span> — <b>${String(p.args.title).replace(/</g,"&lt;")}</b></li>`);
      else if (p.name === "Entered") items.push(`<li><span class="ev">${t("ev_entered")}</span> — <b>${short(p.args.participant)}</b></li>`);
      else if (p.name === "Voted") items.push(`<li><span class="ev">${t("ev_voted")}</span> — <b>${short(p.args.participant)}</b> → ${t("c_opt")} ${Number(p.args.option)+1}</li>`);
      else if (p.name === "Drawn") items.push(`<li><span class="ev">${t("ev_drawn")}</span> — <b>#${p.args.id}</b></li>`);
      else if (p.name === "Claimed") items.push(`<li><span class="ev">${t("ev_claimed")}</span> — <b>${short(p.args.participant)}</b> · ${fmtAmt(p.args.amount)}</li>`);
      else if (p.name === "PrizeClaimed") items.push(`<li><span class="ev">${t("ev_prize")}</span> — <b>${short(p.args.winner)}</b> · ${fmtAmt(p.args.amount)}</li>`);
      if (items.length >= 6) break;
    }
    ul.innerHTML = items.length ? items.join("") : `<li>${t("feed_empty")}</li>`;
  }catch(e){ ul.innerHTML = `<li>${t("feed_fail")}</li>`; }
}

/* ---------- create campaign ---------- */
let createKind = 0; // 0 raffle, 1 vote, 2 claim
function switchCreateTab(k){
  createKind = k;
  document.querySelectorAll(".form > .tabs > button").forEach((b,i)=>b.classList.toggle("on", i===k));
  $("fWinnersRow").style.display = k===0 ? "" : "none";
  $("fOptionsRow").style.display = k===1 ? "" : "none";
  $("fSeedHint").style.display = k===0 ? "" : "none";
  $("fPrizeRow").style.display = (k===0 || k===2) ? "" : "none";
  $("fTokenAddrRow").style.display = (k!==1 && $("fTokenSel").value === "erc20") ? "" : "none";
  $("fPerWinnerRow").style.display = (k===0 && $("fTokenSel").value !== "none") ? "" : "none";
  $("fPoolRow").style.display = k===2 ? "" : "none";
  $("fModeRow").style.display = k===2 ? "" : "none";
  $("fMaxClaimsRow").style.display = k===2 ? "" : "none";
  $("createSubmit").textContent = t(k===0 ? "f_submit_raffle" : k===1 ? "f_submit_vote" : "f_submit_claim");
}
function prizeTokenAddr(){
  const sel = $("fTokenSel").value;
  if (sel === "none") return null;
  if (sel === "bnb") return ethers.ZeroAddress;
  if (TOKEN_PRESETS[sel]) return TOKEN_PRESETS[sel];
  const a = $("fTokenAddr").value.trim();
  return ethers.isAddress(a) ? a : undefined; // undefined = invalid
}
async function parseAmount(token, amtStr){
  if (!token || token === ethers.ZeroAddress) return ethers.parseEther(amtStr);
  const erc = new ethers.Contract(token, ERC20_ABI, signer);
  const dec = await erc.decimals();
  return ethers.parseUnits(amtStr, dec);
}
async function fundApprove(token, total, msg){
  if (token === null || token === ethers.ZeroAddress || total === 0n) return;
  msg.textContent = t("f_approving");
  const erc = new ethers.Contract(token, ERC20_ABI, signer);
  await (await erc.approve(APPS_TESTNET, total)).wait();
}
function markErr(id, bad){ const el = $(id); if(el) el.classList.toggle("f-err", !!bad); return bad; }
function validateCreate(){
  const errs = [];
  document.querySelectorAll(".f-err").forEach(el => el.classList.remove("f-err"));
  const title = ($("fTitle")?.value || "").trim();
  if (markErr("fTitle", !title)) errs.push(t("e_title"));
  const sT = Date.parse($("fStart")?.value || ""), eT = Date.parse($("fEnd")?.value || "");
  if (markErr("fEnd", !(eT > sT) || eT < Date.now())) errs.push(t("e_window"));
  if (createKind === 0){
    const w = parseInt($("fWinners")?.value || "0", 10);
    if (markErr("fWinners", !(w >= 1))) errs.push(t("e_winners"));
    const sel = $("fTokenSel")?.value || "none";
    if (sel === "erc20" && markErr("fTokenAddr", !ethers.isAddress(($("fTokenAddr")?.value || "").trim()))) errs.push(t("e_token"));
    if (sel !== "none" && markErr("fPerWinner", !(parseFloat($("fPerWinner")?.value || "0") > 0))) errs.push(t("e_prize"));
  } else if (createKind === 1){
    const o = parseInt($("fOptions")?.value || "0", 10);
    if (markErr("fOptions", !(o >= 2 && o <= 16))) errs.push(t("e_options"));
  } else {
    const csel = $("fTokenSel")?.value || "none";
    if (csel === "none") errs.push(t("e_token"));
    if (csel === "erc20" && markErr("fTokenAddr", !ethers.isAddress(($("fTokenAddr")?.value || "").trim()))) errs.push(t("e_token"));
    const pool = parseFloat($("fPool")?.value || "0");
    const mc = parseInt($("fMaxClaims")?.value || "0", 10);
    if (markErr("fPool", !(pool > 0))) errs.push(t("e_pool"));
    if (markErr("fMaxClaims", !(mc >= 1))) errs.push(t("e_claims"));
    const random = $("fModeRandom")?.classList.contains("on");
    if (random && pool > 0 && mc >= 1 && markErr("fPool", pool / mc < 0.0001)) errs.push(t("e_dust"));
  }
  const box = $("fErrors");
  if (box){ box.style.display = errs.length ? "" : "none"; box.innerHTML = errs.map(e => `<div>\u00b7 ${e}</div>`).join(""); }
  return errs.length === 0;
}
function renderPreview(){
  const pv = $("createPreview"); if(!pv) return;
  const title = ($("fTitle")?.value || "").trim() || t("f_title_ph");
  let keyline = "", cta = "";
  if (createKind === 0){
    const sel = $("fTokenSel")?.value || "none";
    const w = $("fWinners")?.value || "1";
    keyline = sel !== "none" && parseFloat($("fPerWinner")?.value || "0") > 0
      ? `<b>${$("fPerWinner").value} ${sel === "bnb" ? "BNB" : sel.toUpperCase()}</b> \u00d7 ${w}`
      : `${w} ${t("c_winners")}`;
    cta = t("c_enter");
  } else if (createKind === 1){
    keyline = `${$("fOptions")?.value || "2"} ${t("c_options")}`;
    cta = t("c_vote_btn") + " 1";
  } else {
    const pool = $("fPool")?.value || "0";
    const mc = $("fMaxClaims")?.value || "10";
    const csel2 = $("fTokenSel")?.value || "bnb";
    const tok = csel2 === "erc20" ? "ERC20" : csel2 === "none" ? "BNB" : csel2.toUpperCase();
    keyline = `<b>${pool} ${tok}</b> \u00b7 ${mc} ${t("c_claimed_n")}`;
    cta = t("c_claim_btn");
  }
  pv.innerHTML = `<div class="camp">
    <div class="camp-top"><span class="chip ${createKind === 0 ? "raffle" : ""}">${createKind === 0 ? t("c_raffle") : createKind === 2 ? t("c_claim") : t("c_vote")}</span><span class="chip">${t("c_upcoming")}</span></div>
    <h3>${title.replace(/</g, "&lt;")}</h3>
    <div class="keyline">${keyline}</div>
    <div class="creator-line">${t("creator_by")} 0xYou</div>
    <div class="cta-zone"><button class="cta-btn" disabled style="cursor:default">${cta}</button></div>
  </div>`;
}
async function submitCreate(){
  if(!validateCreate()){ $("formMsg").textContent = ""; return; }
  const msg = $("formMsg");
  if(!signer){ toast(t("m_connect_first")); return; }
  const title = $("fTitle").value.trim();
  const startAt = Math.floor(new Date($("fStart").value).getTime()/1000);
  const endAt = Math.floor(new Date($("fEnd").value).getTime()/1000);
  const nowS = Math.floor(Date.now()/1000);
  if(!title){ msg.textContent = t("f_err_title"); return; }
  if(!startAt || !endAt || endAt <= startAt || startAt < nowS - 120){ msg.textContent = t("f_err_time"); return; }
  try{
    const apps = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer);
    if(createKind === 0){
      const winners = parseInt($("fWinners").value, 10);
      if(!winners || winners < 1){ msg.textContent = t("f_err_winners"); return; }
      let token = prizeTokenAddr();
      if (token === undefined){ msg.textContent = t("f_err_token"); return; }
      let per = 0n;
      if (token !== null){
        const amt = $("fPerWinner").value.trim();
        if(!amt || Number(amt) <= 0){ msg.textContent = t("f_err_amount"); return; }
        per = await parseAmount(token, amt);
      } else token = ethers.ZeroAddress;
      const total = per * BigInt(winners);
      await fundApprove(token, total, msg);
      msg.textContent = t("f_creating");
      chain();
      const latest = await providerTest.getBlock("latest");
      const older = await providerTest.getBlock(latest.number - 200);
      const secPerBlock = Math.max(0.3, (latest.timestamp - older.timestamp) / 200);
      const seedBlock = latest.number + Math.ceil((endAt - latest.timestamp) / secPerBlock) + 40;
      const value = (token === ethers.ZeroAddress) ? total : 0n;
      await (await apps.createRaffle(title, startAt, endAt, winners, seedBlock, token, per, { value })).wait();
    } else if(createKind === 1){
      const options = parseInt($("fOptions").value, 10);
      msg.textContent = t("f_creating");
      await (await apps.createVote(title, startAt, endAt, options)).wait();
    } else {
      let token = prizeTokenAddr();
      if (token === undefined || token === null){ msg.textContent = t("f_err_token"); return; }
      const poolAmt = $("fPool").value.trim();
      const maxClaims = parseInt($("fMaxClaims").value, 10);
      if(!poolAmt || Number(poolAmt) <= 0 || !maxClaims || maxClaims < 1){ msg.textContent = t("f_err_amount"); return; }
      const pool = await parseAmount(token, poolAmt);
      await fundApprove(token, pool, msg);
      msg.textContent = t("f_creating");
      const value = (token === ethers.ZeroAddress) ? pool : 0n;
      const random = $("fModeRandom") && $("fModeRandom").classList.contains("on");
      await (await apps.createClaim(title, startAt, endAt, maxClaims, token, pool, random, { value })).wait();
    }
    // Optional: attach the creator's X post link right away (can also be
    // added or changed later from My Campaigns). A failed second tx must
    // not fail the creation itself.
    const postUrlInput = ($("fPostUrl")?.value || "").trim();
    if (postUrlInput){
      try{
        const nid = Number(await appsRead.campaignCount()) - 1;
        await (await apps.setPostUrl(nid, postUrlInput)).wait();
      }catch(e){ /* link can be set later in My Campaigns */ }
    }
    const seriesInput = ($("fSeries")?.value || "").trim();
    if (seriesInput){
      try{
        const nid = Number(await appsRead.campaignCount()) - 1;
        await (await apps.setSeries(nid, seriesInput)).wait();
      }catch(e){ /* series can be set later in My Campaigns */ }
    }
    msg.textContent = t("f_ok");
  }catch(e){ msg.textContent = (e.shortMessage || e.message || "Failed").slice(0,130); }
}


/* publicnode caps eth_getLogs at 50k blocks per call — chunk wider scans. */
async function getLogsChunked(base, from, to){
  const out = [];
  for (let s = from; s <= to; s += 45000){
    const e = Math.min(to, s + 44999);
    out.push(...await providerTest.getLogs({ ...base, fromBlock: s, toBlock: e }));
  }
  return out;
}



/* ---------- filters (campaigns page) ---------- */
window.applyFilters = () => {
  const q = ($("fltQ")?.value || "").trim().toLowerCase();
  const k = $("fltKind")?.value || "all";
  const s = $("fltStatus")?.value || "all";
  const sr = $("fltSeries")?.value || "all";
  document.querySelectorAll("#campGrid .camp").forEach(el => {
    const ok = (!q || (el.dataset.title || "").includes(q))
      && (k === "all" || el.dataset.kind === k)
      && (s === "all" || el.dataset.status === s)
      && (sr === "all" || (el.dataset.series || "") === sr);
    el.style.display = ok ? "" : "none";
  });
};

function populateSeriesFilters(){
  const sel = $("fltSeries"); if(!sel) return;
  const seen = new Map();
  document.querySelectorAll("#campGrid .camp").forEach(el => {
    const v = el.dataset.series || "";
    if (v && !seen.has(v)) seen.set(v, el.dataset.slabel || v);
  });
  const cur = sel.value;
  sel.innerHTML = `<option value="all">${t("series_all")}</option>` + [...seen.entries()].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  if ([...seen.keys()].includes(cur)) sel.value = cur;
}

/* ---------- campaign detail + draw proof ---------- */
async function loadDetail(){
  const box = $("detailBox"); if(!box) return;
  const id = Number(new URLSearchParams(location.search).get("id"));
  if(!Number.isInteger(id) || id < 0){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; return; }
  chain();
  try{
    const c = await appsRead.getCampaign(id);
    window.__campTitles = window.__campTitles || {}; window.__campTitles[id] = String(c.title);
    const kind = Number(c.kind);
    const nowS = Math.floor(Date.now() / 1000);
    const live = nowS >= Number(c.startAt) && nowS <= Number(c.endAt);
    const ended = nowS > Number(c.endAt);
    const entries = await appsRead.getEntries(id);
    let foot = "";
    if (kind === 0){
      if (live) foot = `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`;
      else if (ended && !c.drawn) foot = `<button class="btn" onclick="drawCampaign(${id})">${t("m_draw")}</button>`;
      else if (c.drawn) foot = `<span class="count">${t("m_drawn")}</span>`;
      if (c.drawn && c.prizePerWinner > 0n) foot += ` <button class="btn ghost" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`;
    } else if (kind === 1){
      const counts = new Array(Number(c.optionCount)).fill(0);
      const latest = await providerTest.getBlockNumber();
      const vlogs = await getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("Voted(uint256,address,uint8)"), ethers.zeroPadValue(ethers.toBeHex(id), 32)] }, APPS_DEPLOY_BLOCK, latest);
      const iface = new ethers.Interface(APPS_ABI);
      for (const l of vlogs){ const p = iface.parseLog(l); if (p) counts[Number(p.args.option)]++; }
      foot = `<div class="tally">` + counts.map((n, oi) => `<button class="opt" onclick="voteCampaign(${id}, ${oi})">${t("c_option")} ${oi + 1} · <b>${n}</b></button>`).join("") + `</div>`;
    } else {
      if (live && Number(c.entryCount) < Number(c.maxClaims)) foot = `<button class="btn" onclick="claimShare(${id})">${t("c_claim_btn")}${c.claimRandom ? "" : " " + fmtAmt(c.claimAmount) + " " + tokenLabel(c.prizeToken)}</button>`;
      else foot = `<span class="count"><b>${c.entryCount}/${c.maxClaims}</b> ${t("c_claimed_n")}</span>`;
    }
    let proof = "";
    if (kind === 0){
      if (!c.drawn) proof = `<div class="sec-head" style="margin-top:34px"><h2 style="font-size:20px">${t("d_proof_h")}</h2></div><div class="empty">${t("d_notdrawn")}</div>`;
      else {
        const winners = await appsRead.getWinners(id);
        proof = `<div class="sec-head" style="margin-top:34px"><h2 style="font-size:20px">${t("d_proof_h")}</h2><p>${t("d_proof_how")}</p></div>
        <div class="panel"><div class="rows">
          <div class="row"><span>${t("d_proof_seedblock")}</span><b>${c.seedBlock}</b></div>
          <div class="row"><span>${t("d_proof_fallback")}</span><b>${c.usedFallbackSeed ? "✓" : "—"}</b></div>
        </div>
        <div style="margin-top:14px"><button class="btn sm" onclick="verifyDraw(${id})">${t("d_proof_verify")}</button> <span class="camp-msg" id="proofMsg"></span></div>
        <div class="rows" style="margin-top:14px"><div class="row"><span>${t("d_winners")}</span><b>${winners.length}</b></div></div>
        <div style="margin-top:8px">${winners.map(w => `<div class="feed-item"><span class="addr">${w}</span></div>`).join("")}</div></div>`;
      }
    }
    let postBtn = "";
    try{
      const pu = await appsRead.postUrl(id);
      if (pu && pu.startsWith("https://")) postBtn = `<a class="btn sm ghost" href="${pu.replace(/"/g, "%22")}" target="_blank" rel="noopener">${t("post_btn")} ↗</a>`;
    }catch(e){}
    const creatorHtmlD = await creatorLabel(c.creator);
    box.innerHTML = `
      <div class="kicker">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")} · #${id}</div>
      <h1 style="font-size:clamp(26px,4.4vw,40px);margin:10px 0 6px">${String(c.title).replace(/</g,"&lt;")}</h1>
      <p style="color:var(--muted)">${t("creator_by")} ${creatorHtmlD} · ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}${live || !ended ? ` · <span class="cd" data-start="${c.startAt}" data-end="${c.endAt}"></span>` : ""}</p>
      <div style="margin:16px 0">${foot} <span class="camp-msg" id="msg-${id}"></span></div>
      ${postBtn ? `<div style="margin-bottom:6px">${postBtn}</div>` : ""}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" onclick="shareCampaign(${id})">${t("share_btn")}</button><button class="btn ghost" onclick="makePoster(${id})">${t("poster_btn")}</button></div>
      <div class="sec-head" style="margin-top:26px"><h2 style="font-size:20px">${t("d_participants")} · ${entries.length}</h2></div>
      <div class="panel">${entries.length ? entries.map(a => `<div class="feed-item"><span class="addr">${a}</span></div>`).join("") : `<div class="empty">${t("rec_none")}</div>`}</div>
      ${proof}
      <div class="trust-row">${t("d_contract")} <a href="https://testnet.bscscan.com/address/${APPS_TESTNET}" target="_blank" rel="noopener">${short(APPS_TESTNET)} \u2197</a> \u00b7 HumanGate <a href="https://testnet.bscscan.com/address/0x4858c1c6a4428c65ee6f60aac21a3f404d85d598" target="_blank" rel="noopener">${short("0x4858c1c6a4428c65ee6f60aac21a3f404d85d598")} \u2197</a> \u00b7 ${(kind !== 1 && (c.prizePerWinner > 0n || c.pool > 0n)) ? t("d_escrow") : t("d_escrow_no")}</div>`;
    const sb = $("stickyBar");
    if (sb){
      let sAct = "", sInfo = "";
      if (kind === 0 && live){ sAct = `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`; sInfo = c.prizePerWinner > 0n ? `${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}` : String(c.title).replace(/</g, "&lt;"); }
      else if (kind === 0 && ended && !c.drawn){ sAct = `<button class="btn" onclick="drawCampaign(${id})">${t("m_draw")}</button>`; sInfo = String(c.title).replace(/</g, "&lt;"); }
      else if (kind === 0 && c.drawn && c.prizePerWinner > 0n){ sAct = `<button class="btn" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`; sInfo = `${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}`; }
      else if (kind === 2 && live && Number(c.entryCount) < Number(c.maxClaims)){ sAct = `<button class="btn" onclick="claimShare(${id})">${t("c_claim_btn")}</button>`; sInfo = `${fmtAmt(c.pool)} ${tokenLabel(c.prizeToken)}`; }
      if (sAct){ sb.innerHTML = `<span class="sb-info">${sInfo}</span>${sAct}`; sb.classList.add("on"); }
    }
    tickCountdowns();
  }catch(e){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}
window.verifyDraw = async id => {
  const msg = $("proofMsg"); if(msg) msg.textContent = "…";
  try{
    const c = await appsRead.getCampaign(id);
    const entries = await appsRead.getEntries(id);
    const onchain = (await appsRead.getWinners(id)).map(a => a.toLowerCase());
    const latest = await providerTest.getBlockNumber();
    const logs = await getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("Drawn(uint256,uint256,bool,uint256)"), ethers.zeroPadValue(ethers.toBeHex(id), 32)] }, APPS_DEPLOY_BLOCK, latest);
    const iface = new ethers.Interface(APPS_ABI);
    const ev = iface.parseLog(logs[logs.length - 1]);
    const seed = ev.args.seed;
    const n = entries.length, k = Math.min(Number(c.winnerCount), n);
    const idx = entries.map((_, i) => i);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const mine = [];
    for (let i = 0; i < k; i++){
      const j = i + Number(BigInt(ethers.keccak256(coder.encode(["uint256", "uint256"], [seed, i]))) % BigInt(n - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
      mine.push(entries[idx[i]].toLowerCase());
    }
    const ok = mine.length === onchain.length && mine.every((a, i) => a === onchain[i]);
    if(msg){ msg.textContent = ok ? "✓ " + t("d_proof_ok") : "✗ " + t("d_proof_bad"); msg.style.color = ok ? "var(--gold)" : "#ff7a7a"; }
  }catch(e){ if(msg) msg.textContent = t("load_fail"); }
};

/* ---------- X binding (tweet-tier statement, no database) ---------- */
function bindStatement(handle, address){
  return `HumanGate X binding
Handle: @${handle}
Address: ${address.toLowerCase()}
Network: BNB Chain`;
}
const __bindCache = {};
async function creatorBinding(addr){
  const k = String(addr).toLowerCase();
  if(!(k in __bindCache)){
    __bindCache[k] = (async () => {
      try{
        if(!bindingsRead) chain();
        const b = await bindingsRead.bindingOf(addr);
        if(!b[0]) return null;
        return (await bindingsRead.isBindingValid(addr)) ? b[0] : null;
      }catch(e){ return null; }
    })();
  }
  return __bindCache[k];
}
async function creatorLabel(addr){
  const h = await creatorBinding(addr);
  return h
    ? `<a href="creator.html?a=${addr}" style="color:var(--gold);text-decoration:none">@${h} \u2713</a>`
    : `<a href="creator.html?a=${addr}" style="color:inherit;text-decoration:none">${short(addr)}</a>`;
}
let lastBind = null;
window.makeBinding = async () => {
  const out = $("bindOut"); if(out) out.innerHTML = "…";
  try{
    const signer = await connectWallet();
    const address = await signer.getAddress();
    const handle = ($("bindHandle").value || "").trim().replace(/^@/, "").toLowerCase();
    if(!handle) throw new Error("handle");
    const stmt = bindStatement(handle, address);
    const sig = await signer.signMessage(stmt);
    lastBind = { handle, sig };
    const tweet = `Binding my X on HumanGate: @${handle} <-> ${address}
Sig: ${sig}
#HumanGateBind`;
    const tweetUrl = "https://x.com/intent/tweet?text=" + encodeURIComponent(tweet);
    out.innerHTML = `<div class="rows">
      <div class="row"><span>${t("bind_stmt")}</span><b style="white-space:pre-wrap;text-align:right">${stmt.split("\n").join("<br>")}</b></div>
      <div class="row"><span>${t("bind_sig")}</span><b style="word-break:break-all;text-align:right;max-width:60%">${sig}</b></div></div>
      <p style="margin-top:14px;color:var(--muted)">${t("bind_tweet")}</p>
      <button class="btn sm" onclick="window.open('${tweetUrl}', '_blank')">${t("bind_post")}</button>`;
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">${t("tx_fail")}</span>`; }
};
window.verifyBinding = async () => {
  const out = $("bindVerifyOut"); if(out) out.innerHTML = "…";
  try{
    const handle = ($("vHandle").value || "").trim().replace(/^@/, "").toLowerCase();
    const address = ethers.getAddress(($("vAddr").value || "").trim());
    const sig = ($("vSig").value || "").trim();
    const recovered = ethers.verifyMessage(bindStatement(handle, address), sig);
    if (recovered.toLowerCase() !== address.toLowerCase()){ out.innerHTML = `<span style="color:#ff7a7a">✗ ${t("bind_bad")}</span>`; return; }
    chain();
    const bal = await registry.balanceOf(address);
    let onchain = "";
    try{
      const b = await bindingsRead.bindingOf(address);
      if (b[0] === handle && await bindingsRead.isBindingValid(address)) onchain = `<br><span style="color:var(--gold)">✓ ${t("bind_onchain")}</span>`;
    }catch(e){}
    out.innerHTML = `<span style="color:var(--gold)">✓ ${t("bind_ok").replace("{h}", handle)}</span><br>` +
      (bal > 0n ? `<span style="color:var(--gold)">✓ ${t("bind_ok_human")}</span>` : `<span style="color:var(--muted)">${t("bind_not_human")}</span>`) + onchain;
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">✗ ${t("bind_bad")}</span>`; }
};

/* ---------- platform stats (unique humans, payouts) ---------- */
async function loadPlatformStats(){
  if(!$("statHumans")) return;
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    const logs = await getLogsChunked({ address: APPS_TESTNET }, APPS_DEPLOY_BLOCK, latest);
    const iface = new ethers.Interface(APPS_ABI);
    const humans = new Set(); let payouts = 0;
    for (const log of logs){
      let p; try{ p = iface.parseLog(log); }catch(e){ continue; }
      if(!p) continue;
      if (p.name === "Entered") humans.add(p.args.participant);
      else if (p.name === "Voted") humans.add(p.args.participant);
      else if (p.name === "Claimed"){ humans.add(p.args.participant); payouts++; }
      else if (p.name === "PrizeClaimed") payouts++;
    }
    $("statHumans").textContent = humans.size;
    if($("statPayouts")) $("statPayouts").textContent = payouts;
  }catch(e){ /* keep last rendered values */ }
}

/* ---------- campaign poster (16:9) ---------- */
window.makePoster = async id => {
  try{
    chain();
    const c = await appsRead.getCampaign(id);
    const cv = $("posterCanvas"); if(!cv) return;
    const x = cv.getContext("2d");
    const W = 1600, H = 900;
    x.fillStyle = "#0a0a0b"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#f0b90b"; x.lineWidth = 3; x.strokeRect(28, 28, W - 56, H - 56);
    x.textAlign = "left";
    x.fillStyle = "#f0b90b"; x.font = "700 34px monospace"; x.fillText("HUMANGATE", 80, 110);
    x.fillStyle = "#8a8a93"; x.font = "26px monospace"; x.textAlign = "right"; x.fillText("ONE HUMAN \u00b7 ONE ENTRY", W - 80, 110); x.textAlign = "left";
    const kind = Number(c.kind);
    x.fillStyle = "#e8e8ec"; x.font = "30px monospace";
    x.fillText(kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote"), 80, 196);
    x.fillStyle = "#ffffff"; x.font = "800 86px sans-serif";
    let line = ""; const lines = [];
    for (const ch of String(c.title)){ const test = line + ch; if (x.measureText(test).width > W - 160 && line){ lines.push(line); line = ch; } else line = test; }
    lines.push(line);
    const shown = lines.slice(0, 2);
    if (lines.length > 2) shown[1] += "\u2026";
    shown.forEach((ln, i2) => x.fillText(ln, 80, 306 + i2 * 102));
    const y0 = 306 + shown.length * 102 + 44;
    x.fillStyle = "#f0b90b"; x.font = "700 62px sans-serif";
    let big = "";
    if (kind === 0) big = `${t("c_prize")} ${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)} \u00d7 ${c.winnerCount}`;
    else if (kind === 2) big = `${t("c_pool")} ${fmtAmt(c.pool)} ${tokenLabel(c.prizeToken)}`;
    else big = `${c.entryCount} ${t("c_entries")}`;
    x.fillText(big, 80, y0);
    x.fillStyle = "#c9c9d1"; x.font = "32px sans-serif";
    const hb = await creatorBinding(c.creator);
    x.fillText(`${t("creator_by")} ${hb ? "@" + hb : short(c.creator)}`, 80, y0 + 72);
    x.fillText(`${fmtTime(c.startAt)} \u2192 ${fmtTime(c.endAt)}`, 80, y0 + 124);
    let seriesTag = ""; try{ seriesTag = await appsRead.series(id); }catch(e){}
    x.fillStyle = "#8a8a93"; x.font = "26px monospace";
    x.fillText((seriesTag ? seriesTag + " \u00b7 " : "") + "Agent ID gated \u00b7 BNB Chain Testnet", 80, H - 84);
    const a = document.createElement("a");
    a.download = `humangate-campaign-${id}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  }catch(e){ toast(t("load_fail")); }
};

/* ---------- identicon (deterministic avatar from address) ---------- */
function drawIdenticon(addr, cvId){
  const cv = $(cvId || "cardAvatar"); if(!cv) return;
  const x = cv.getContext("2d");
  const bytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(String(addr).toLowerCase())));
  const cell = cv.width / 5;
  x.fillStyle = "#101013"; x.fillRect(0, 0, cv.width, cv.height);
  const palette = ["#f0b90b", "#ffd75e", "#c99400", "#6b5514"];
  for(let r = 0; r < 5; r++) for(let c = 0; c < 3; c++){
    const b = bytes[r * 3 + c];
    if(b % 2 === 0){
      x.fillStyle = palette[b % palette.length];
      x.fillRect(c * cell, r * cell, cell, cell);
      if(c !== 2) x.fillRect((4 - c) * cell, r * cell, cell, cell);
    }
  }
}

/* ---------- share card image (card page) ---------- */
let lastRecord = null; // {addr, entered, voted, claimed, wins}
function drawShareCard(){
  const cv = $("shareCanvas"); if(!cv || !lastRecord) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(240,185,11,.55)"; ctx.lineWidth = 3; ctx.strokeRect(14, 14, W-28, H-28);
  ctx.fillStyle = "#f0b90b"; ctx.font = "700 30px 'Space Grotesk', sans-serif";
  ctx.fillText("HumanGate", 56, 84);
  ctx.font = "500 17px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#9a9aa3";
  ctx.fillText("ONE HUMAN · ONE ENTRY", 56, 116);
  ctx.fillStyle = "#ececec"; ctx.font = "800 64px 'Space Grotesk', sans-serif";
  ctx.fillText(t("img_verified"), 56, 226);
  ctx.font = "500 24px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#f0b90b";
  const a = lastRecord.addr;
  ctx.fillText(a.slice(0, 18) + "…" + a.slice(-10), 56, 282);
  ctx.font = "600 30px 'Space Grotesk', sans-serif"; ctx.fillStyle = "#ececec";
  const stats = `${lastRecord.entered} ${t("img_entries")}   ·   ${lastRecord.wins} ${t("img_wins")}   ·   ${lastRecord.claimed} ${t("img_claims")}`;
  ctx.fillText(stats, 56, 372);
  ctx.font = "500 18px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#6d6d75";
  ctx.fillText("Agent ID · BNB Chain · " + new Date().toISOString().slice(0, 10), 56, H - 52);
  $("shareDl").href = cv.toDataURL("image/png");
  $("shareCardBox").style.display = "";
}
window.shareCardPost = () => {
  const text = t("card_img_share_text") + " " + SITE_URL + " #BinanceWalletHackathon #AgenticWallet";
  window.open("https://x.com/intent/tweet?text=" + encodeURIComponent(text), "_blank");
};

/* ---------- creator page ---------- */
async function loadCreator(){
  const box = $("creatorBox"); if(!box) return;
  const addr = new URLSearchParams(location.search).get("a");
  if(!addr || !ethers.isAddress(addr)){ box.innerHTML = `<div class="empty">${t("creator_none")}</div>`; return; }
  chain();
  $("creatorAddr").textContent = short(addr);
  creatorBinding(addr).then(hb => { if (hb) $("creatorAddr").textContent = "@" + hb + " \u2713 \u00b7 " + short(addr); });
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(addr, 32);
    const logs = await getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("CampaignCreated(uint256,address,uint8,string,uint64,uint64)"), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
    if(!logs.length){ box.innerHTML = `<div class="empty">${t("creator_none")}</div>`; return; }
    let totalEntries = 0;
    const cards = [];
    for (const log of logs.slice().reverse()){
      const id = Number(BigInt(log.topics[1]));
      const c = await appsRead.getCampaign(id);
      totalEntries += Number(c.entryCount);
      const kind = Number(c.kind);
      cards.push(`<div class="camp">
        <div class="camp-top"><span class="chip ${kind === 0 ? "raffle" : ""}">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")}</span></div>
        <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
        <div class="meta"><b>${t("c_window")}</b> ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}<br><b>${c.entryCount}</b> ${t("c_entries")}${kind === 0 && c.prizePerWinner > 0n ? `<br><b>${t("c_prize")}</b> ${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}` : ""}${kind === 2 ? `<br><b>${t("c_pool")}</b> ${fmtAmt(c.pool)} ${tokenLabel(c.prizeToken)}` : ""}</div>
        <div class="foot"><a class="btn sm" href="campaign.html?id=${id}" style="text-decoration:none">${t("d_details")}</a></div>
      </div>`);
    }
    box.innerHTML = `<div style="display:flex;gap:34px;flex-wrap:wrap;margin-bottom:18px">
        <div class="stat"><b>${logs.length}</b><span>${t("creator_camps")}</span></div>
        <div class="stat"><b>${totalEntries}</b><span>${t("creator_entries")}</span></div>
      </div><div class="camp-grid">${cards.join("")}</div>`;
  }catch(e){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}

/* ---------- participation record (card page) ---------- */
async function loadRecord(addr){
  const box = $("recordBox"); if(!box) return;
  box.innerHTML = `<div class="empty">${t("rec_loading")}</div>`;
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(addr, 32);
    const from = APPS_DEPLOY_BLOCK;
    const [entered, voted, claimed] = await Promise.all([
      getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("Entered(uint256,address)"), null, topicAddr] }, from, latest),
      getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("Voted(uint256,address,uint8)"), null, topicAddr] }, from, latest),
      getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("Claimed(uint256,address,uint256)"), null, topicAddr] }, from, latest),
    ]);
    const ids = new Set();
    entered.forEach(l => ids.add(Number(BigInt(l.topics[1]))));
    voted.forEach(l => ids.add(Number(BigInt(l.topics[1]))));
    claimed.forEach(l => ids.add(Number(BigInt(l.topics[1]))));
    let wins = 0;
    const rows = [];
    lastRecord = { addr, entered: entered.length, voted: voted.length, claimed: claimed.length, wins: 0 };
    for (const id of [...ids].sort((a,b)=>b-a)){
      const c = await appsRead.getCampaign(id);
      let badge = "";
      if (Number(c.kind) === 0 && c.drawn && (await appsRead.isWinner(id, addr))){ wins++; badge = ` · <b style="color:var(--gold)">${t("rec_won")} ✓</b>`; }
      rows.push(`<li><b>${String(c.title).replace(/</g,"&lt;")}</b> <span style="color:var(--faint)">#${id}${badge}</span></li>`);
    }
    if(lastRecord) lastRecord.wins = wins;
    const scb = $("shareCardBtns"); if(scb) scb.style.display = rows.length ? "" : "none";
    if (!rows.length){ box.innerHTML = `<div class="empty">${t("rec_none")}</div>`; return; }
    box.innerHTML = `<div class="strip-in" style="display:flex;gap:34px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat"><b>${entered.length}</b><span>${t("rec_entered")}</span></div>
        <div class="stat"><b>${voted.length}</b><span>${t("rec_voted")}</span></div>
        <div class="stat"><b>${claimed.length}</b><span>${t("rec_claimed")}</span></div>
        <div class="stat"><b>${wins}</b><span>${t("rec_won")}</span></div>
      </div><ul style="list-style:none;font-size:14.5px;line-height:2.1;color:var(--muted)">${rows.join("")}</ul>`;
  }catch(e){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}

/* ---------- my campaigns ---------- */
async function renderMineSummary(createdCount){
  const box = $("mineSummary"); if(!box || !myAddr) return;
  box.style.display = "flex";
  drawIdenticon(myAddr, "mineAvatar");
  const pb = $("mineProfileBtn"); if (pb) pb.href = "card.html?a=" + myAddr;
  const meta = $("mineMeta"); if (meta) meta.textContent = myAddr;
  const nm = $("mineName"); if (nm) nm.textContent = short(myAddr);
  creatorBinding(myAddr).then(h => { if (h && nm) nm.textContent = "@" + h; }).catch(() => {});
  readHuman(myAddr).then(h => { const hb = $("mineHuman"); if (hb) hb.style.display = h ? "" : "none"; }).catch(() => {});
  const setN = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  setN("msCreated", createdCount);
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(myAddr, 32);
    const scan = (sig) => getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id(sig), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
    const eL = await scan("Entered(uint256,address)");
    const vL = await scan("Voted(uint256,address,uint8)");
    const cL = await scan("Claimed(uint256,address,uint256)");
    setN("msEntered", eL.length + vL.length + cL.length);
    let won = 0;
    const ids = [...new Set(eL.map(l => Number(BigInt(l.topics[1]))))];
    for (const id of ids){
      try{ const c = await appsRead.getCampaign(id); if (c.drawn && await appsRead.isWinner(id, myAddr)) won++; }catch(e){}
    }
    setN("msWon", won);
  }catch(e){}
}
async function loadMine(){
  const grid = $("mineGrid"); if(!grid) return;
  if(!myAddr){ grid.innerHTML = `<div class="empty">${t("mine_connect")}</div>`; return; }
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(myAddr, 32);
    const logs = await getLogsChunked({ address: APPS_TESTNET, topics: [ethers.id("CampaignCreated(uint256,address,uint8,string,uint64,uint64)"), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
    renderMineSummary(logs.length);
    if(!logs.length){ grid.innerHTML = `<div class="empty">${t("mine_none")}</div>`; return; }
    const cards = [];
    for (const log of logs.slice().reverse()){
      const id = Number(BigInt(log.topics[1]));
      const c = await appsRead.getCampaign(id);
      const now = Math.floor(Date.now()/1000);
      const ended = now > Number(c.endAt);
      const kind = Number(c.kind);
      let actions = "";
      if (kind === 0 && ended && !c.drawn) actions += `<button class="btn sm" onclick="drawCampaign(${id})">${t("c_draw")}</button>`;
      if (kind === 0 && c.drawn) actions += `<button class="btn sm ghost" onclick="copyWinners(${id}, this)">${t("m_copy")}</button>`;
      if ((kind === 2 && ended && !c.reclaimed) || (kind === 0 && c.drawn && !c.reclaimed && now > Number(c.endAt) + 2592000)) actions += `<button class="btn sm ghost" onclick="reclaimCampaign(${id})">${t("m_reclaim")}</button>`;
      const curPost = await appsRead.postUrl(id).catch(() => "");
      const curSeries = await appsRead.series(id).catch(() => "");
      cards.push(`<div class="camp">
        <div class="camp-top"><span class="chip ${kind === 0 ? "raffle" : ""}">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")}</span><span class="chip ${ended ? "ended" : "live"}">${ended ? t("c_ended") : t("c_live")}</span></div>
        <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
        <div class="meta"><b>${t("c_window")}</b> ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}<br><b>${t("c_entries")}</b> ${c.entryCount}${kind === 0 && c.prizePerWinner > 0n ? `<br><b>${t("c_prize")}</b> ${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)} · ${t("paid_out")} ${fmtAmt(c.paidOut)}` : ""}${kind === 2 ? `<br><b>${t("c_pool")}</b> ${fmtAmt(c.pool)} ${tokenLabel(c.prizeToken)} · ${t("paid_out")} ${fmtAmt(c.paidOut)}` : ""}</div>
        <div class="foot" style="gap:8px;flex-wrap:wrap">${actions}<span class="camp-msg" id="msg-${id}"></span></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12.5px;color:var(--faint)">${t("post_set")}</span>
          <input id="posturl-${id}" type="text" value="${curPost.replace(/"/g, "%22")}" placeholder="${t("post_ph")}" style="flex:1;min-width:200px;background:#101013;border:1px solid var(--line);border-radius:8px;color:var(--text);padding:8px 10px;font:inherit;font-size:13px">
          <button class="btn sm ghost" onclick="setPostUrlMine(${id})">${t("post_save")}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12.5px;color:var(--faint)">${t("f_series")}</span>
          <input id="series-${id}" type="text" value="${curSeries.replace(/"/g, "%22")}" placeholder="${t("series_ph")}" style="flex:1;min-width:200px;background:#101013;border:1px solid var(--line);border-radius:8px;color:var(--text);padding:8px 10px;font:inherit;font-size:13px">
          <button class="btn sm ghost" onclick="setSeriesMine(${id})">${t("series_set")}</button>
        </div>
      </div>`);
    }
    grid.innerHTML = cards.join("");
  }catch(e){ grid.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}
window.copyWinners = async (id, btn) => {
  try{
    const w = await appsRead.getWinners(id);
    await navigator.clipboard.writeText(w.join("\n"));
    btn.textContent = t("m_copied");
  }catch(e){ toast(t("load_fail")); }
};

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  document.querySelectorAll(".connectBtn").forEach(b => b.addEventListener("click", () => { if (myAddr) disconnectWallet(); else connectWallet(); }));
  const ldd = $("learnDd");
  if (ldd){
    const lbtn = $("learnBtn");
    if (ldd.querySelector(".nav-dd-menu a.on")) lbtn.classList.add("on");
    lbtn.addEventListener("click", e => { e.stopPropagation(); ldd.classList.toggle("open"); });
    document.addEventListener("click", e => { if(!ldd.contains(e.target)) ldd.classList.remove("open"); });
    document.addEventListener("keydown", e => { if(e.key === "Escape") ldd.classList.remove("open"); });
  }
  (async () => {
    try{
      if(!window.ethereum) return;
      try{ if (sessionStorage.getItem("hg_dc")) return; }catch(e){}
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if(!accs || !accs[0]) return;
      myAddr = accs[0];
      document.querySelectorAll(".connectBtn").forEach(b => { b.textContent = short(myAddr); b.title = t("nav_disconnect"); });
      readHuman(myAddr).then(h => { if(h) document.querySelectorAll(".connectBtn").forEach(b => { b.textContent = short(myAddr) + " \u2713"; b.title = t("nav_human") + " \u00b7 " + t("nav_disconnect"); }); }).catch(() => {});
      if ($("campGrid") || $("soonGrid")) loadCampaigns();
      if ($("detailBox")) loadDetail();
      if ($("cardBtn") && !new URLSearchParams(location.search).get("a")) { $("cardInput").value = myAddr; $("cardBtn").click(); }
    }catch(e){}
  })();
  if (window.ethereum && window.ethereum.on) window.ethereum.on("accountsChanged", accs => { if (myAddr && (!accs || !accs[0] || accs[0].toLowerCase() !== myAddr.toLowerCase())) disconnectWallet(); });
  const cb = $("checkBtn");
  if (cb) cb.onclick = () => checkAddress($("checkInput").value.trim(), $("verdict"));
  const ci = $("checkInput");
  if (ci) ci.addEventListener("keydown", e => { if(e.key === "Enter") cb.click(); });
  const ts = $("trySample");
  if (ts) ts.onclick = () => { $("checkInput").value = SAMPLE_HOLDER; cb.click(); };
  const kb = $("cardBtn");
  if (kb) kb.onclick = async () => {
    const addr = $("cardInput").value.trim();
    if(!ethers.isAddress(addr)){ toast(t("card_invalid")); return; }
    $("cardAddr").textContent = addr;
    if ($("cardName")) $("cardName").textContent = short(addr);
    drawIdenticon(addr);
    $("cardStatus").textContent = t("card_reading"); $("cardStatus").className = "status none";
    let human = null;
    try{ human = await readHuman(addr); }catch(e){}
    if(human === null){ $("cardStatus").textContent = t("card_fail"); return; }
    $("cardStatus").textContent = t(human ? "card_yes" : "card_no");
    $("cardStatus").className = "status" + (human ? "" : " none");
    $("cardNote").textContent = t(human ? "card_note_yes" : "card_note_no");
    toggleGuide(human === false);
    loadRecord(addr);
    const hbEl = $("cardBinding");
    if (hbEl){ hbEl.innerHTML = ""; creatorBinding(addr).then(hb => { const be = $("bindEntryStatus"); if (be) be.textContent = hb ? "@" + hb + " \u2713" : t("card_bind_none"); if (hb) { const nm = $("cardName"); if (nm) nm.textContent = "@" + hb; hbEl.innerHTML = `<a href="https://x.com/${hb}" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;font-family:var(--mono);font-size:15px">@${hb}</a> <span style="color:var(--gold);font-size:12px;border:1px solid rgba(240,185,11,.45);border-radius:99px;padding:2px 8px">${t("bind_bound")}</span>`; } }); }
  };
  const kbAuto = new URLSearchParams(location.search).get("a");
  if (kb && kbAuto && ethers.isAddress(kbAuto)) { $("cardInput").value = kbAuto; kb.click(); }
  const clb = $("copyLinkBtn");
  if (clb) clb.onclick = async () => {
    const a2 = ($("cardAddr")?.textContent || "").trim();
    if (!ethers.isAddress(a2)) return;
    try{ await navigator.clipboard.writeText(location.origin + location.pathname + "?a=" + a2); toast(t("m_copied")); }catch(e){}
  };
  if ($("campGrid") || $("statCampaigns")) loadCampaigns();
  if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail();
  const scb = $("makeCardBtn");
  if (scb) scb.addEventListener("click", drawShareCard);
  if ($("feedList")){ loadFeed(); setInterval(loadFeed, 25000); }
  if ($("createSubmit")){
    // Default window: starts in 5 minutes, ends in 3 days.
    const toLocal = d => { const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    $("fStart").value = toLocal(new Date(Date.now() + 5*60000));
    $("fEnd").value = toLocal(new Date(Date.now() + 3*86400000));
    document.querySelectorAll(".form > .tabs > button").forEach((b,i)=> b.addEventListener("click", ()=>switchCreateTab(i)));
    $("createSubmit").addEventListener("click", submitCreate);
    document.querySelectorAll(".form input, .form select").forEach(el => el.addEventListener("input", renderPreview));
    document.querySelectorAll(".form .tabs button").forEach(b => b.addEventListener("click", () => setTimeout(renderPreview, 60)));
    renderPreview();
    const mf = $("fModeFixed"), mr = $("fModeRandom");
    if (mf && mr){
      mf.addEventListener("click", () => { mf.classList.add("on"); mr.classList.remove("on"); });
      mr.addEventListener("click", () => { mr.classList.add("on"); mf.classList.remove("on"); });
    }
    const tsel = $("fTokenSel");
    if (tsel) tsel.addEventListener("change", () => {
      $("fTokenAddrRow").style.display = tsel.value === "erc20" ? "" : "none";
      $("fPerWinnerRow").style.display = (tsel.value !== "none" && createKind === 0) ? "" : "none";
    });
    switchCreateTab(0);
  }
});
