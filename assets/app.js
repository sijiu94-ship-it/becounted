/* BeCounted — shared logic: i18n, registry checker, wallet, campaigns, ID card */
const REGISTRY_MAINNET = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const APPS_TESTNET     = "0xA62C7b17B9110A1223De95E1CCdD654aa138d2e1"; // OneIDCampaignsV12 = V11 code wired to IdentityBindingsV4 (mainnet)
const BINDINGS_TESTNET = "0x5FC906B394BA23Dd1B546aea8F217101DEc07F85"; // IdentityBindingsV4 (self-registration + cooldown)
const PROFILE_TESTNET  = "0x42c9f4bfa02e0b4365d9701f962b4dcd4bf39a07"; // IdentityProfile (Wave 2)
const PROFILE_ABI = [
  "function setProfile(string bio, tuple(string title, string url)[] links)",
  "function removeProfile()",
  "function profileOf(address who) view returns (string bio, tuple(string title, string url)[] links, uint64 updatedAt)"
];
const GATE_TESTNET     = "0xda585a4ae5b73ee2728aada3e877a3a1f84027cd"; // BeCounted (testnet, V11 trial stack gate)
const QUEST_TESTNET = "0x0000000000000000000000000000000000000000";
const QUEST_ABI = [
  "function claimStamp()", "function enterFinale()", "function lockFinaleSeed()", "function drawFinale()", "function claimPrize()",
  "function phase() view returns (uint8)", "function currentDay() view returns (uint32)",
  "function startAt() view returns (uint64)", "function stampEnd() view returns (uint64)", "function entryEnd() view returns (uint64)",
  "function slotsPerDay() view returns (uint32)", "function dayPool() view returns (uint256)", "function minStamps() view returns (uint32)",
  "function finalePool() view returns (uint256)", "function prizePerWinner() view returns (uint256)", "function token() view returns (address)",
  "function stampCount(address) view returns (uint32)", "function stampBitmap(address) view returns (uint8)",
  "function dayClaims(uint32) view returns (uint32)", "function eligible(address) view returns (bool)",
  "function hasEnteredFinale(address) view returns (bool)", "function isWinner(address) view returns (bool)",
  "function prizeClaimed(address) view returns (bool)", "function finaleDrawn() view returns (bool)",
  "function finaleSeedBlock() view returns (uint64)", "function finaleEntryCount() view returns (uint256)",
  "function getFinaleEntries() view returns (address[])", "function getWinners() view returns (address[])"
];
const GATE_ABI = ["function isHuman(address) view returns (bool)"];
/* CheckIn — daily check-in feeding the activity weight. Address below is
   the BSC TESTNET trial deployment (checkin-address.json, 2026-11-25);
   swap it and CHECKIN_DEPLOY_BLOCK when the mainnet contract deploys.
   Until then the check-in page probes for code at this address on the
   apps chain and degrades to a "coming soon" state when there is none. */
const CHECKIN_TESTNET  = "0x74b413451a5244bc0630c176badaddab981366e8"; // CheckIn (testnet trial)
const CHECKIN_DEPLOY_BLOCK = 135653273; // CheckIn deployment block: CheckedIn scans start here
const CHECKIN_ABI = [
  "function checkIn()",
  "function todayIndex() view returns (uint256)",
  "function hasCheckedInToday(address) view returns (bool)",
  "function windowCountOf(address) view returns (uint256)",
  "function weightOf(address) view returns (uint256)",
  "function totalCheckInsOf(address) view returns (uint256)",
  "function lastCheckInDayOf(address) view returns (uint256)",
  "event CheckedIn(address indexed user, uint256 dayIndex, uint256 totalCheckIns)",
  "error NotHuman(address account)",
  "error AlreadyCheckedIn(address account, uint256 dayIndex)"
];
const BINDINGS_ABI = [
  "function registerBinding(string,bytes)", "function proofTypeOf(address) view returns (uint8)", "function registerSelf(string,uint256)",
  "function removeBinding()",
  "function bindingOf(address) view returns (string,bytes,uint64)",
  "function isBindingValid(address) view returns (bool)",
  "function proofRefOf(address) view returns (uint256)",
  "function lastRegisteredAt(address) view returns (uint64)"
];
const SAMPLE_HOLDER    = "0x119B2Bf71856155b234f818476ae0610634A2aB9"; // 9nosing.ai
const ERC721_ABI = ["function balanceOf(address) view returns (uint256)"];
const APPS_ABI = [
  "function campaignCount() view returns (uint256)",
  "function conditionsOf(uint256) view returns (tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot, bytes32 idListRoot))",
  "function gate() view returns (address)",
  "function idRegistry() view returns (address)",
  "function getEntries(uint256) view returns (address[])",
  "function getWinners(uint256) view returns (address[])",
  "function getCampaign(uint256) view returns (tuple(address creator, uint8 kind, string title, uint64 startAt, uint64 endAt, uint32 winnerCount, uint64 seedBlock, bool drawn, bool usedFallbackSeed, uint8 optionCount, uint256 entryCount, address prizeToken, uint256 prizePerWinner, uint256 pool, uint256 claimAmount, uint32 maxClaims, bool claimRandom, uint256 paidOut, bool reclaimed, string prizeLabel))",
  "function hasEntered(uint256, address) view returns (bool)","function voteOf(uint256,address) view returns (uint8)",
  "function tally(uint256, uint8) view returns (uint256)",
  "function getWinners(uint256) view returns (address[])",
  "function isWinner(uint256, address) view returns (bool)",
  "function prizeClaimed(uint256, address) view returns (bool)",
  "function enterRaffle(uint256, bytes32[], bytes32[])",
  "function castVote(uint256, uint8, bytes32[], bytes32[])",
  "function draw(uint256)",
  "function lockDraw(uint256)",
  "error InsufficientReceived()", "error ClaimExpired()", "error SeedNotLocked()", "error SeedExpired()", "error SeedLocked()",
  "function claim(uint256, bytes32[], bytes32[])",
  "function claimPrize(uint256)",
  "function reclaim(uint256)",
  "function createRaffle(string, uint64, uint64, uint32, address, uint256, tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot, bytes32 idListRoot), string) payable returns (uint256)",
  "function createVote(string, uint64, uint64, uint8, address, uint256, uint32, tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot, bytes32 idListRoot), string[]) payable returns (uint256)",
  "function optionLabelsOf(uint256) view returns (string[])",
  "function createClaim(string, uint64, uint64, uint32, address, uint256, bool, tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot, bytes32 idListRoot)) payable returns (uint256)",
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
const SITE_URL = "https://becounted.9nosing.com/";
/* Network config — mainnet launch changes ONLY this block plus the APPS
   address above, TOKEN_PRESETS and SITE_URL. */
const NETWORK = {
  appsChainId: 56, appsChainHex: "0x38",
  appsRpcs: ["https://bsc-dataseed.binance.org","https://bsc-rpc.publicnode.com","https://rpc.ankr.com/bsc","https://bsc-dataseed1.bnbchain.org","https://bsc-dataseed2.bnbchain.org"],
  mainRpcs: ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com", "https://rpc.ankr.com/bsc", "https://bsc-dataseed1.bnbchain.org", "https://bsc-dataseed2.bnbchain.org"],
};
const APPS_DEPLOY_BLOCK = 135784191; // V12 deployment block: event scans start here
// Token presets. Testnet addresses verified on-chain (symbol/decimals read
// 2026-11-21). Mainnet switch on 2026-11-25: USDT 0x55d398326f99059fF775485246999027B3197955,
// USDC 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d (both 18 decimals on BSC).
const TOKEN_PRESETS = {
  usdt: "0x55d398326f99059fF775485246999027B3197955",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
};
// Lowercased preset address set, derived from TOKEN_PRESETS so the presets
// stay the single source of truth (detail-page custom-token warning).
const PRESET_TOKEN_ADDRS = new Set(Object.values(TOKEN_PRESETS).map(a => String(a).toLowerCase()));
const ERC20_ABI = [
  "function approve(address, uint256) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const I18N = {
en: {
  nav_campaigns:"Campaigns", nav_how:"How it works", nav_builders:"Builders", nav_card:"ID Card", nav_checkin:"Check-in",
  connect:"Connect wallet",
  kick_home:"Agent ID · BNB Chain · Sybil Resistance",
  h1a:"One human.", h1b:"One", h1c:"entry.",
  hero_sub:"Raffles and votes where every entry is backed by <b>exactly one KYC-anchored human</b> — not one wallet, not one botnet. BeCounted reads Binance <b>Agent ID</b> on-chain and lets only verified humans through. The second address simply doesn't pass.",
  hero_note:"One person, one entry — enforced by structure, not by rules.",
  check_label:"Check any address against the live Agent ID registry (BNB mainnet)",
  check_btn:"Is human?",
  check_try:"Try a known holder:",check_sample_mask:"9nosing.ai's Agentic Wallet address (hidden in this demo)", check_try_link:"9nosing.ai's wallet", check_try2:"— or paste your own Agentic Wallet address.",
  stat_campaigns:"campaigns on mainnet", stat_entries:"verified-human entries",
  
  demo_h:"Watch the gate work \u2014 no wallet needed", demo_sub:"A live-fire demo against the real Agent ID registry on BNB mainnet. Send a bot farm at the gate, then send one real human. Same entrance, same one-line check.",
  demo_btn_bots:"Send 100 bots", demo_btn_human:"Send 1 human", demo_btn_reset:"Reset",
  demo_c_try:"attempted", demo_c_pass:"passed", demo_c_reject:"rejected",
  demo_stage:"DEMO RAFFLE \u2014 ENTRY GATE", demo_empty:"Nobody has tried the gate yet. Pick a side.",
  demo_checking:"checking registry\u2026", demo_rejected:"REJECTED \u00b7 not in registry", demo_passed:"PASSED \u00b7 ticket #1 issued",
  demo_bot_tag:"BOT", demo_human_tag:"HUMAN \u00b7 sample holder",
  demo_cap0:"Bots don\u2019t lose on speed, budget or numbers \u2014 they lose because the registry has never heard of them.",
  demo_cap_bots:"100 fresh addresses, 100 registry lookups, 0 found. On-chain, every one of these entries reverts NotHuman before it can touch the prize pool.",
  demo_cap_human:"One address, one lookup, found instantly. That is the whole trick: the gate asks the registry, not the crowd.",
  demo_note:"Live reads against the BNB mainnet Agent ID registry. Bot addresses are generated locally in your browser \u2014 none of them has ever held an Agent ID.",
  demo_err:"Registry read failed (RPC busy) \u2014 reset and try again.",
  t1_no:"01 / Campaigns", t1_h:"Enter with your one ID", t1_p:"Live raffles and votes gated by BeCounted. One Agent ID, one entry — duplicates and second wallets are rejected on-chain.", t_go:"Open →",
  t2_no:"02 / How it works", t2_h:"Two questions, two keys", t2_p:"Why the gate is stateless, why dedup belongs to each campaign, and the three things BeCounted will never do.", t_go2:"Read →",
  t3_no:"03 / Builders", t3_h:"One read call is the API", t3_p:"Contract addresses, the integration snippet, and the is-human skill any AI agent can run before it acts.", t_go3:"Build →",
  foot_l:"BeCounted — built for the Binance Wallet × BNB Chain Agent ID Hackathon. Token prizes are escrowed in the contract and claimed by winners on-chain; off-chain prizes are delivered by creators to the drawn winner list. The chain proves who entered and who won.",
  foot_r:"live on mainnet · Binance Wallet × BNB Chain Agent ID Hackathon",
  v_invalid_t:"INVALID", v_invalid:"That is not a wallet address.",
  v_reading:"Reading the registry…",
  v_yes_t:"UNIQUE HUMAN", v_yes:"Holds an Agent ID — exactly one KYC-anchored human is behind this address.",
  v_yes_s:"Uniqueness is proven. Trustworthiness is not — that part is still on you.",
  v_no_t:"NOT VERIFIED", v_no:"No Agent ID at this address — it cannot pass the gate.",
  v_no_s:"Agent IDs live in the Agentic Wallet. Check you pasted that address, not your main wallet.",
  v_err_t:"ERROR", v_err:"Registry read failed — try again in a moment.",
  // campaigns page
  kick_camp:"Live on BNB mainnet",
  h_camp:"Campaigns",
  camp_sub:"Every entry below passed the BeCounted check. The contracts read the real Agent ID registry on BNB mainnet — any holder can enter.",
  loading:"Loading campaigns from chain…", load_fail:"Could not reach BNB mainnet right now — refresh in a moment.", no_camp:"No campaigns yet.",
  c_raffle:"Raffle", c_vote:"Vote", c_live:"Live", c_ended:"Ended", c_upcoming:"Upcoming", c_drawn:"Drawn",
  c_window:"Window", c_winners:"Winners", c_options:"Options",
  c_entries:"verified entries", c_winner:"Winner:", c_enter:"Enter raffle", c_draw:"Draw now",
  c_opt:"Option", c_vote_btn:"Vote",
  m_connect_first:"Connect your wallet first (top right). Entry requires an Agent ID in your Agentic Wallet.",
  m_signing:"Waiting for signature…", m_done:"Done — refreshing…",
  m_nowallet:"No wallet found — open this page in a wallet browser or install MetaMask.",
  m_connected:"Connected on BSC mainnet: ", m_rejected:"Connection rejected or failed.", m_wrongnet:"Connected, but your wallet is not on BSC mainnet - switch to BSC mainnet before joining a campaign.", m_pending:"Your wallet already has a pending request - open the wallet and confirm it first.", m_disconnected:"Disconnected.", nav_switch:"Switch account", nav_exit:"Disconnect", m_checking:"Checking eligibility\u2026", m_waiting:"Sent \u2014 waiting for on-chain confirmation\u2026", m_need_human:"This address has no Agent ID, so it cannot join yet. Claim an Agent ID in the Binance App first \u2014 see the guide.", f_live_only:"Live only", qr_h:"Card QR code", qr_sub:"Scan to open this card", cert_btn:"Draw certificate", cert_entries:"Entries", cert_winners:"Winners", cert_each:"each", cert_recompute:"anyone can recompute this draw on the campaign page", cert_done:"Certificate downloaded.", mine_joined_h:"Campaigns I joined", j_mystatus:"My status", j_entered:"Entered", j_notwon:"Not a winner this time", j_winner:"You won - claim your prize on the campaign page", j_won_claimed:"Prize claimed", j_voted:"Voted", j_claimed:"Claimed", j_none:"You have not joined any campaigns yet.", d_show_all:"Show all", cd_sec:"4 \u00b7 Entry conditions (optional)", cd_bind:"Must have a bound X account", cd_token:"Token holding gate", cd_721:"This is an NFT (count by balance)", cd_721_hint:"NFT gate: the address above is the NFT contract, the number is how many they must hold (usually 1). At entry the contract checks balanceOf - it returns the count they hold.", cd_prior:"Must have entered campaign #", cd_stamps:"Must hold expedition stamps \u2265", cd_hint:"Conditions are checked on-chain at entry. A follow on X cannot be verified on-chain - the binding condition is its trustless counterpart: every entrant carries a public handle anyone can check.", cd_err_token:"Enter a valid gate token address.", cd_err_min:"Enter a minimum holding above zero.", cd_err_prior:"Enter the earlier campaign number.", cd_err_stamps:"Stamps required: 1 to 7.", chip_bind:"X bound", chip_token:"Hold", chip_nft:"NFT", chip_prior:"Entered", chip_stamps:"Stamps", m_cond_0:"This campaign requires a bound X account - bind yours from your identity card first.", m_cond_1:"You do not hold enough of the gate token for this campaign.", m_cond_2:"This campaign is for returning participants - enter the earlier campaign first.", m_cond_3:"You need more expedition stamps for this campaign.", chip_allow:"Allowlist", chip_id:"Agent ID list", m_cond_5:"This campaign is limited to listed Agent IDs - your Agent ID is not on the list (or your address has no Agent ID name). If you have the name list, import it on the campaign page first.", cd_id:"Agent ID allowlist - only listed Agent IDs can join", cd_id_list:"Agent ID list", cd_id_ph:"One Agent ID name per line (.ai suffix optional)", cd_id_dl:"Download list file", cd_err_id:"The list is empty or contains an invalid name.", cd_id_hint:"The list is committed as hashes of the names themselves - it holds identities, never wallet addresses. A mistyped name fails silently: it simply never matches anyone. Check every name carefully.", idlst_h:"Agent ID allowlist", idlst_hint:"This campaign is limited to the Agent IDs on a list committed on-chain as a Merkle root of name hashes - identities only, no wallet addresses. Import the name list to check yours and join.", idlst_ph:"Paste the Agent ID name list here", idlst_in:" \u00b7 your Agent ID is on the list \u2713", idlst_out:" \u00b7 your Agent ID is not on the list", idlst_nohandle:" \u00b7 your address has no Agent ID name", m_cond_4:"This campaign is allowlist-only. Import the address list on the campaign page, then try again.", cd_allow:"Allowlist only - only listed addresses can join", cd_allow_list:"Address list", cd_allow_ph:"One address per line (or comma-separated)", cd_allow_dl:"Download list file", cd_err_allow:"The list is empty or contains an invalid address.", lst_h:"Allowlist", lst_hint:"This campaign is limited to an address list committed on-chain as a Merkle root. Import the list to check your address and join.", lst_ph:"Paste the address list here", lst_save:"Save list", lst_in:" \u00b7 your address is on the list \u2713", lst_out:" \u00b7 your address is not on the list", lst_root_ok:"List matches the on-chain root \u2713", lst_root_bad:"This list does not match the on-chain root \u2717", vp_on:"Add a prize pool drawn among voters", vp_note:"After the vote ends, winners are drawn at random from ALL voters - the option picked plays no role - and split the pool equally. Winners claim on-chain; anyone can recompute the draw.", vp_total:"Total prize pool", vp_winners:"Prize winners", vp_err_token:"Pick a prize token for the voter prize.", vp_err_total:"Enter a prize pool above zero.", c_vote_prize:"voter prize", nav_quest:"Expedition", q_kicker:"GENESIS EXPEDITION \u00b7 SEASON 0", q_title:"The Human Expedition", q_sub:"Seven days, seven stamps, one finale. Only verified humans can stamp - one per day, paid instantly in lucky shares. Collect at least 5 stamps to enter the finale draw.", q_stat_daypool:"stamp pool / day", q_stat_slots:"stamp slots / day", q_stat_finale:"finale pool", q_stat_min:"stamps to enter finale", q_my_h:"My expedition", q_day:"Day", q_today_claim:"Claim today's stamp", q_today_done:"Stamped today", q_today_full:"Today's stamps are gone", q_today_left:"left today:", q_notstarted:"Season starts", q_connect_hint:"Connect your wallet to play.", q_skill_hint:"Holding an Agent ID? The Agentic Wallet can't connect to websites — join through your Agent instead, with the participation Skill:", q_skill_link:"Open the participation Skill", q_finale_h:"Finale", q_enter:"Enter the finale", q_entered:"Entered the finale", q_need_more:"stamps short:", q_eligible_yes:"Finale eligible", q_genesis:"Genesis participant", q_seed_lock:"Lock the draw seed", q_draw_btn:"Draw the finale", q_drawn_h:"Finale drawn", q_claim_prize:"Claim prize", q_prize_claimed:"Prize claimed", q_entries_h:"Finale entries", q_phase_entry:"entries close", q_winner_tag:"WINNER", q_rules_h:"How it works", q_rules_1:"One stamp per human per day. Each stamp pays a lucky share of the day's pool, instantly.", q_rules_2:"Collect at least 5 of 7 stamps to enter the finale. Entry is one per human.", q_rules_3:"The finale draw seed is locked on-chain after entries close; anyone can recompute the winners. Stamp randomness is entertainment-grade pseudo-randomness - small daily amounts by design.", q_card_h:"Expedition - Season 0", m_switch_hint:"This wallet cannot switch accounts here. Switch the account inside your wallet, then refresh.", prof_h:"Profile links", prof_self:"Self-described \u00b7 on-chain", prof_edit_h:"Edit your profile", prof_bio:"One-line bio", prof_bio_ph:"Say who you are in one line", prof_title_ph:"Title, e.g. X", prof_url_ph:"https://\u2026", prof_save:"Save on-chain", prof_remove:"Remove profile", prof_saved:"Profile saved on-chain.", prof_removed:"Profile removed.", prof_note:"Bio and links are written by the owner and stored on-chain. Self-described, not verified.",
  // how page
  kick_how:"The design", h_how:"Two questions. Two keys.",
  how_sub:"Sybil resistance is two different questions. Most systems mash them into one database and one admin key. We keep them apart — that separation is the whole design.",
  q1_k:"Question 1 — asked on every call", q1_h:"“Is a unique human behind this address?”",
  q1_p:"Keyed by <code>address</code>. Answered by the BeCounted primitive: a single read of the Agent ID registry, <code>isHuman(address) → bool</code>. Stateless, read-only, no owner, non-upgradeable. Deployed once, never touched again — anyone can verify that on-chain.",
  q1_who:"Answered by →", q1_who_b:"BeCounted (the primitive)",
  q2_k:"Question 2 — asked once per campaign", q2_h:"“Has this human already been counted here?”",
  q2_p:"Keyed by <code>Agent ID</code>. Answered by each campaign's own bookkeeping — the state lives with the caller, not in the primitive. Because an Agent ID is non-transferable and lives in exactly one wallet, per-campaign dedup by the holding address is dedup by the ID itself.",
  q2_who:"Answered by →", q2_who_b:"each campaign contract (the caller)",
  bounds_h:"Three lines we won't cross",
  b1_x:"NEVER — 01", b1_h:"No reverse lookup", b1_p:"We answer address → human?, and we provide no name → wallet lookup to anyone. A gate is not a surveillance tool, and we won't build one. The only internal use is at a holder's own request, to register their own binding - never displayed, never stored.",
  b2_x:"NEVER — 02", b2_h:"No character judgement", b2_p:"An Agent ID proves “same unique person”, never “trustworthy person”. Accountable is not the same as trusted.",
  b3_x:"NEVER — 03", b3_h:"No sybil hunting", b3_p:"We don't cluster, score or expose anyone's other addresses. Extra addresses simply don't pass the gate. That's enough.",
  why_h:"Why a primitive, not a platform",
  why_p:"Platforms hold your data and ask to be trusted. A primitive holds nothing: no database, no admin key, no off switch. Ptah's Proof of Agent draws and a wave of one-per-person mints already check the Agent ID registry by hand — BeCounted turns that proven pattern into one call any contract, and any agent, can reuse.",
  // builders page
  kick_build:"Integration", h_build:"For builders",
  build_sub:"One read call is the whole integration. If your contract can call a view function, you have sybil resistance.",
  code_note:"Gate any function with one line. The primitive is stateless — your contract keeps its own per-campaign dedup, keyed by the human.",
  a_gate:"BeCounted — BSC mainnet", a_apps:"OneIDCampaigns — BSC mainnet", a_bind:"IdentityBindingsV3", a_quest:"QuestPass — BSC mainnet", a_reg:"Agent ID registry — BSC mainnet", a_skill:"Agent skill",
  a_skill_v:"is-human — a zero-dependency checker any AI agent can run before it acts. Source in the project repo.",
  a_profile:"IdentityProfile (bio + links)", embed_h:"Embed the check on your site", embed_p:"Two lines of code put a live Agent ID check on any web page. It reads the registry directly - no API key, no backend, read-only. For on-chain gating, use the contract interface or the template instead.",
  nav_white:"Whitepaper", kick_wp:"WHITEPAPER", h_wp:"The BeCounted Whitepaper", wp_sub:"What this is, how it works, what it refuses to do, and where its limits are - in one page.",
  wp1_h:"Thesis: addresses are transport, identity is the person", wp1_p:"Sybil attacks are not a verification problem, they are a structure problem: minting addresses is free, so any defense priced per address eventually loses. Agent ID changes the unit - one KYC, one ID, non-transferable. BeCounted turns that fact into a single question any contract can ask: isHuman(address).",
  wp2_h:"The two-key principle", wp2_p:"Key one - 'is this a unique human?' - is asked by address, on every call, and answered by the primitive. Key two - 'has this human been counted in this activity?' - is keyed by the holder, and its state lives with the caller. The primitive itself stores nothing: no lists, no scores, no history. That is deliberate - a gate that remembers nothing has nothing to leak, sell, or misuse.",
  wp3_h:"Three boundaries", wp3_p:"Three refusals, by design: no reverse lookup (we provide no name-to-wallet lookup and show no one its result; the sole internal use is registering a holder's own binding at their own request, never displayed or stored), no character judgment (the gate proves sameness, never trustworthiness), and no small-account hunting (no clustering, no labeling). Each refusal gives up a business we could have had - and keeps the one question we answer clean.",
  wp4_h:"Security model", wp4_1:"The gate is read-only: a view function with no owner, no upgrade path, and no pause switch. Nobody can change its answer, including us.", wp4_2:"Prizes are escrowed by the campaign contract the moment a campaign is created. Winners claim for themselves; a prize unclaimed after 30 days returns to the creator.", wp4_3:"Draws are reproducible: after a campaign ends, anyone can lock the seed on-chain — the hash of the second block after locking, unknowable in advance because entries are already closed — and anyone can recompute the winner list from public data - the campaign page does it in one click.", wp4_4:"Honest randomness: the lucky-claim mode uses blockhash pseudo-randomness, labelled in the contract and the UI as entertainment-grade, for small pools only.", wp4_5:"The site never asks for unlimited approvals: token escrow approves the exact amount, once.",
  wp5_h:"Built to the contest's security red lines", wp5_p:"No third-party Agentic Wallet login (participation happens through the user's own agent with per-call confirmation \u2014 the Agentic Wallet never connects to this or any third-party site). No silent or bundled transfers. No unlimited approvals. Contracts are open source, with owner powers disclosed - there are none. No name impersonates Binance or BNB. And no mnemonics, private keys, or pairing codes are ever collected. Our own agent tooling is read-only by design.",
  wp6_h:"Known limitations", wp6_1:"The gate is not narrow in supply: Agent ID holders already number over 263,000 (registry count, November 2026) and issuance keeps growing. The real limit is reach - most holders have never heard of any given campaign, so every gated campaign still starts from a zero audience. The contract does not change; the discovery does.", wp6_2:"Uniqueness is capped by KYC, not by mathematics: one person holding several verified identities could hold several IDs. We claim 'one identity, one entry' - not 'one soul, one entry'.", wp6_3:"If Binance rebuilds or replaces the Agentic Wallet, how an ID carries over is Binance's call, not ours. Our claim is narrower, and honest: the first working interface for a proven pattern - not 'the standard'.",
  wp7_h:"Contracts", wp7_p:"Live on BSC mainnet. Addresses verified on BscScan.", wp8_h:"The Mark", wp8_1:"At the center stands the human. BeCounted verifies one thing — that a participant is a unique real human — so the human stands in front, and everything else serves them.", wp8_2:"Behind the human, two keys are crossed like a swordsman's blades: the two-key principle. One key answers 'is this a unique human?' — checked on every entry. The other answers 'has this human been counted in this campaign?' — once per campaign, never twice. Together they guard the fairness of every campaign: one human, one entry, no bot farms.", wp8_3:"The disc is a golden seal. To be counted is to be stamped — the one mark every counted participant carries. Gold is the color of the ecosystem we build on; the circle means no one missing, no one counted twice.",
  skill_h:"For agents, not just contracts",
  skill_p:"The same check ships as a skill: an AI agent about to enter, claim or pay can ask “is a unique human behind this address?” and get an answer whose evidence is on-chain — not issued by us, not stored by us.",
  // card page
  kick_card:"Read-only identity", h_card:"The ID card",
  card_sub:"What a verified human looks like on the other side of the gate. Generated from chain state in your browser — nothing is stored, nothing is tracked.",
  card_btn:"Generate", card_lbl:"BECOUNTED · IDENTITY CARD", card_not:"NOT CHECKED", card_reading:"READING…", card_fail:"READ FAILED",
  card_yes:"✓ UNIQUE HUMAN", card_no:"NO AGENT ID",
  card_note0:"Enter an address to read its Agent ID status from the BNB mainnet registry. This card proves uniqueness and continuity — the same one person, only one of them. It says nothing about whether that person is trustworthy.",
  card_note_yes:"This address holds an Agent ID on BNB Chain: one verified human, one identity, non-transferable and bound to a single Agentic Wallet. It can be counted exactly once in any BeCounted campaign — here, and everywhere the gate is used.",
  card_note_no:"No Agent ID is bound to this address. It may be a regular wallet, or the wrong address — Agent IDs live in the Agentic Wallet created inside the Binance app.",
  card_invalid:"Not a valid address",
  nav_create:"Create",
  nav_mine:"Mine",
  share_btn:"Share", c_option:"Option", m_draw:"Draw now", m_drawn:"Drawn", tx_fail:"Transaction failed", post_btn:"Creator's post", post_set:"X post link", post_ph:"Paste the post URL (https://x.com/...)", post_save:"Save link", f_posturl:"Your X post link (optional — can add later)",
  nav_bind:"Bind X",
  flt_search_ph:"Search campaigns…", flt_all:"All", flt_live:"Live", flt_upcoming:"Upcoming", flt_ended:"Ended",
  d_details:"Details", d_participants:"Participants", exp_btn:"Export list (CSV)", d_winners:"Winners", d_back:"All campaigns",
  d_proof_h:"Draw proof — verify it yourself", d_proof_seedblock:"Seed block",
  d_proof_fallback:"Fallback seed used (original seed block aged out)", d_proof_verify:"Recompute winners",
  d_proof_ok:"Recomputed winners match the on-chain winners exactly.", d_proof_bad:"Mismatch — do not trust this draw.",
  d_proof_how:"Winners are picked by a partial Fisher–Yates shuffle: for each slot i, j = i + keccak256(seed, i) mod (n − i) over the entry list, in entry order. Anyone can redo this math.",
  d_notdrawn:"Not drawn yet — after the end time, anyone can lock the draw seed and then trigger the draw.",
  d_notfound:"This campaign doesn't exist (yet) — it may be a testnet link or a mistyped id.",
  d_lock_seed:"Lock the draw seed", d_lock_hint:"Seed = the hash of the 2nd block after locking. Entries are closed, so nobody can predict it — anyone may lock.",
  d_seed_wait:"Seed locked — waiting for the seed block", d_seed_block:"seed block", d_cur_block:"current block",
  d_relock_seed:"Seed expired — lock again", d_seed_expired:"The locked seed block aged out (over 256 blocks). Lock a fresh one to draw.",
  m_err_claim_expired:"The 30-day claim window has closed — this prize can no longer be claimed.",
  m_err_insufficient:"The prize token arrived short — tokens with a transfer tax (fee-on-transfer) cannot be used as prizes. Use a standard token or BNB.",
  m_err_seed_notlocked:"No draw seed is locked yet — lock the seed first.", m_err_seed_expired:"The locked seed has expired — lock it again, then draw.", m_err_seed_locked:"A draw seed is already locked and still valid.",
  bind_kick:"Social binding", bind_h:"Bind your X account",
  bind_sub:"A public, verifiable statement — not a trust score. It proves this X account and this wallet are the same person, nothing more. The tweet itself is the record; there is no database. A binding publicly links your X account to this address — that is its purpose. Your Agent ID is never used to look your wallet up for anyone: the only resolution ever made is by your own agent, at your own request, to recompute your proof code and register — the project never resolves, displays or stores it.",
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
    warn_token: "Custom prize token — its value and transferability are not verified. Check the token contract before entering.",
    d_contract: "Contract",
    hero_cta_join: "Join a campaign",
    hero_cta_create: "Create a campaign",
    bind_bound: "Bound on-chain",
    bind_register: "Register this binding on-chain",
    bind_registered: "Binding registered \u2014 your @handle now shows on your campaigns.",
    bind_need_sig: "Generate the signature first (step 2).",
    bind_onchain: "Binding also registered on-chain",
  bind_self_h:"Bind an Agentic Wallet address (self-registration)", bind_self_sub:"An Agentic Wallet cannot sign messages, so it cannot use the signature flow above. Instead: post one public tweet from your X account naming your X handle and your Agent ID name — never your address — then hand the tweet link to your own agent. It verifies the post and registers the binding from your wallet, usually within a minute or two. The tweet's status id is stored on-chain as evidence, so the claim stays publicly checkable forever — and you may delete the tweet afterwards; the record stands. Two honest limits: the account side is your claim anchored to that post — weaker than a signature, and labelled as such — and registrations are limited to one per address per 24 hours. Read this before you bind: registration makes the pairing of your X account and this address public on-chain, permanently — anyone can look it up from the address. Only bind an address you are willing to have publicly linked to your X account.", bind_self_make:"Generate my verification tweet", bind_self_post:"Post it on X", bind_self_note:"After posting, copy the instruction below, add your tweet link at the end, and give it to your agent (the one that operates your Agentic Wallet). It verifies the post — author, exact wording, and the proof code recomputed from your wallet address — then registers the binding on-chain from your wallet. No registrar, no queue. Afterwards, check the status here.", bind_self_cmd:"Register my BeCounted X binding. Follow the self-registration section of the BeCounted Skill (https://becounted.9nosing.com/becounted-skill.md). My verification tweet: ", bind_self_copy:"Copy instruction", bind_self_check:"Check registration status", bind_self_none:"No binding registered for this address yet.", bind_self_sig:"Registered — signature proof.", bind_self_proof:"Registered — self-registration (post-anchored).", bind_self_tag:"self-registered", bind_agentic_ph:"0x… (Agentic Wallet address)", bind_f_agent:"Agent ID", bind_agent_ph:"e.g. name.ai", bind_self_addr_note:"Used only on this page, locally, to compute your proof code. It is not posted and not sent anywhere.",
    card_copy_link: "Copy card link",
    series_set: "Set series",
    series_ph: "Series label, e.g. Season 2",
    f_series: "Series label (optional)",
    series_all: "All series",
    poster_btn: "Make a poster",

  stat_humans:"Verified humans in", stat_payouts:"Payouts made",
  
  
  
  card_img_btn:"Make my share card", card_img_dl:"Download PNG", card_img_share:"Post it on X",
  card_img_share_text:"I\'m a verified unique human on BeCounted — one KYC, one Agent ID, zero bots. Check your own address:",
  img_verified:"VERIFIED UNIQUE HUMAN", img_entries:"entries", img_wins:"wins", img_claims:"claims",
  creator_kick:"Creator", creator_h:"Creator page", creator_camps:"campaigns", creator_entries:"total entries",
  creator_none:"This address has not created any campaign yet.",
  creator_by:"by",

  share_text_raffle:"I just entered \"{title}\" on BeCounted — one Agent ID, one ticket. Bot farms can\'t get in, every entry is a verified unique human. Join me:",
  share_text_vote:"I just voted in \"{title}\" on BeCounted — one Agent ID, one vote, no sybil stuffing. Have your say:",
  share_text_claim:"I just claimed my share in \"{title}\" on BeCounted — one Agent ID, one share, paid on-chain instantly. Claim yours:",
  share_text_win:"I won \"{title}\" on BeCounted and claimed the prize on-chain — one Agent ID, one ticket, provably fair draw. Next one:",
  share_done_hint:"Done! Share it on X — posts with #BinanceWalletHackathon #AgenticWallet can also win the official 100 USDC community prize (register your post link in the official form to count):",
  guide_h:"No Agent ID yet? Get one in the Binance app — about 3 minutes",
  guide_1:"Open the Binance app and go to Wallet",
  guide_2:"Tap the Agent ID banner on the wallet home page",
  guide_3:"Claim your name.ai — one KYC, one ID, free (a little BNB covers gas)",
  guide_4:"Join through your agent with the BeCounted Skill — an Agent ID never connects to a website directly",
  join_h:"Have an Agent ID? Join through your agent — three steps",
  join_1:"Send your agent the BeCounted participation Skill (button below)",
  join_2:"Tell it in plain words: “Join the BeCounted genesis raffle for me”",
  join_3:"Your agent previews the call first — confirm once, and the transaction goes out from your own Agentic Wallet address",
  join_note:"Season activities need no X binding and no sign-up beforehand — your address is your identity.",
  join_btn:"Open the participation Skill →",
  pskill_note:"Holders join the same way — through their own agent. The participation Skill is the instruction file for that: your agent joins season activities for you, previewing every call for your confirmation first.",
  pskill_link:"BeCounted participation Skill →",
  nav_skill:"Skill",
  kick_skill:"For holders", h_skill:"The participation Skill, on one page.",
  skill_sub:"This is the instruction file your agent follows to join BeCounted activities for you. Read it right here — or copy the link below and send it to your agent; it reads the same source file.",
  skill_copy_btn:"Copy the Skill link", skill_copied:"Skill link copied — send it to your agent", skill_copy_fail:"Copy failed — the raw link is at the bottom of this page",
  skill_loading:"Loading the Skill…", skill_raw_note:"Source file — the exact file your agent reads:", skill_raw_open:"Open the raw Skill file →",
  pskill_raw:"Raw file for agents: becounted-skill.md",
  home_skill_banner:"Have an Agent ID? Send your agent the participation Skill — it joins for you →",
  camp_skill_hint:"Agent ID holder?", camp_skill_link:"Join through your own agent → Participation Skill",
  cd_ends:"ends in", cd_starts:"starts in", cd_d:"d", cd_h:"h", cd_m:"m",
  soon_h:"Ending soon", soon_sub:"Live now, closing first — do not miss the window.",
  hot_h:"Trending", hot_camps:"Hot campaigns", hot_creators:"Top creators", hot_entries:"entries",
  f_tok_usdt:"USDT \u00b7 {chain} (preset)", f_tok_usdc:"USDC \u00b7 {chain} (preset)", f_tok_custom:"Custom prize (off-chain)", f_chain_main:"BSC mainnet", f_chain_test:"BSC testnet",
  f_prize_label:"Prize description (stored on-chain)", f_prize_label_ph:"e.g. Partner whitelist spot \u00d71", f_custom_hint:"Off-chain prizes are NOT escrowed by the contract. Winners are drawn on-chain; you deliver the prize to the winner list yourself.", f_err_label:"Describe the custom prize (1\u201380 bytes).", c_custom_tag:"off-chain prize", d_custom_note:"Off-chain prize \u2014 delivered by the creator to the winners; nothing is escrowed on-chain.", d_custom_claim:"You won \u2014 the creator delivers this off-chain prize.",

  c_claim:"Claim drop", c_pool:"Pool", c_each:"Each gets", c_claimed_n:"claimed", c_claim_btn:"Claim",
  c_prize:"Prize", c_claim_prize:"Claim prize", c_prize_claimed:"Prize claimed",
  ev_claimed:"claimed a share", ev_prize:"claimed a prize",
  f_tab_claim:"Claim drop",
  f_mode:"Payout mode", f_mode_fixed:"Fixed shares", f_mode_random:"Lucky draw (random)",
  f_mode_hint:"Lucky draw uses the double-mean rule: every draw lands between a minimum and twice the remaining average, the last claimant takes the rest. Amounts are drawn from on-chain pseudo-randomness — made for fun-size pools.",
  c_lucky:"Lucky draw",

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
  feed_h:"Live from the gate — BSC mainnet", feed_blk:"block",
  ev_created:"campaign created", ev_entered:"entered raffle", ev_voted:"voted", ev_drawn:"raffle drawn",
  feed_empty:"No events yet in the recent window.", feed_fail:"Feed unavailable right now.",
  cta_h:"Run your own draw — gated by real humans",
  cta_p:"Anyone can create a raffle or vote here. Every entry passes an on-chain Agent ID check first: one human, one entry — studios and bots don't get in. You bring the prize and the people; the contract keeps it fair.",
  cta_btn:"Create a campaign",
  kick_create:"Open to everyone", h_create:"Create a campaign",
  create_sub:"No permission needed, no listing fee, token prizes are fully escrowed in the contract. Set it up, share the link, and every entry is verified against Agent ID automatically.",
  f_title:"Title", f_title_ph:"e.g. Community airdrop draw — 20 USDC",
  f_start:"Starts at", f_end:"Ends at", f_winners:"Number of winners",
  f_options:"Number of options (2–16)", f_opt_labels:"Option texts", e_opt_label:"Fill in every option text (1-60 bytes each).",
  f_seed_hint:"No seed is set at creation. After the campaign ends, anyone can lock the draw seed on-chain — the hash of the second block after locking, which nobody can know in advance because entries are already closed. Results are reproducible by anyone.",
  f_prize_hint:"The prize is escrowed in the contract in full when you create the campaign. Winners claim on-chain; anything unclaimed for 30 days can be reclaimed by you.",
  f_submit_raffle:"Create raffle", f_submit_vote:"Create vote",
  f_tab_raffle:"Raffle", f_tab_vote:"Vote",
  f_err_title:"Give the campaign a title.", f_err_time:"End time must be after the start time, and the start cannot be in the past.",
  f_err_winners:"Winners must be at least 1.",
  flt_empty:"No campaigns match — try different filters", flt_clear:"Clear filters",
  rec_prompt:"Enter an address to see its participation record",
  j_connect:"Connect your wallet to see the campaigns you joined.",
  bind_f_x:"X account", bind_f_addr:"Address", bind_f_sig:"Signature",
  err_read:"Could not read this campaign's conditions — check your connection and try again.",
  stat_fail:"unavailable",
  f_ok:"Campaign created — it's live on the Campaigns page now. Share it!",
  f_creating:"Creating on-chain…",
  kick_ci:"Daily check-in · activity weight", h_ci:"Daily check-in",
  ci_sub:"One check-in per human per day — gated by Agent ID and recorded on-chain. Your check-in days inside the last 30 days set your activity weight: <b>weight = 1 + days</b>. Anyone can recompute it from the event log.",
  ci_bj:"Beijing time",
  ci_status_connect:"Connect your wallet to see your check-in status.",
  ci_status_ready:"You have not checked in yet today.",
  ci_status_done:"Checked in today ✓ — see you tomorrow.",
  ci_stat_total:"Total check-ins", ci_stat_window:"Days in last 30", ci_stat_weight:"My weight",
  ci_weight_formula:"weight = 1 + check-in days in the last 30 days · days older than 30 slide out of the window",
  ci_stat_next:"Next check-in opens in", ci_btn:"Check in", ci_btn_done:"Checked in ✓",
  ci_not_holder:"This wallet holds no Agent ID, so it cannot check in. Check-in is for Agent ID holders only — one ID, one check-in per day.",
  ci_note_agent:"Your Agent ID lives in the Agentic Wallet? It can't connect to websites — ask your Agent to check in for you with the participation Skill:",
  ci_note_link:"Open the participation Skill",
  ci_soon_h:"Check-in opens soon",
  ci_soon:"The check-in contract is not live on this network yet. The moment it is deployed, this page lights up on its own — nothing to update.",
  ci_board_h:"Most active",
  ci_board_sub:"Ranked by total check-in days, read straight from the on-chain CheckedIn log. Truncated addresses only — names never appear next to addresses on this site.",
  ci_col_addr:"Address", ci_col_days:"days total", ci_col_weight:"weight",
  ci_board_empty:"No check-ins yet — be the first.",
  ci_board_loading:"Reading the check-in log…",
  ci_board_fail:"Could not read the check-in log right now — try again in a moment.",
  ci_done_toast:"Checked in — see you tomorrow.",
  ci_err_already:"You have already checked in today.",
  ci_err_nothuman:"This wallet holds no Agent ID — it cannot pass the human gate.",
},
zh: {
  nav_campaigns:"活动", nav_how:"原理", nav_builders:"开发者", nav_card:"身份卡", nav_checkin:"签到",
  connect:"连接钱包",
  kick_home:"Agent ID · BNB 链 · 抗女巫",
  h1a:"一个真人。", h1b:"一张", h1c:"票。",
  hero_sub:"在这里，每一次报名背后都站着<b>恰好一个经过 KYC 锚定的真人</b>——不是一个钱包，更不是一群机器人。BeCounted 在链上读取币安 <b>Agent ID</b>，只放行已验证的真人。第二个地址，就是过不去。",
  hero_note:"一人一票——不是规则定的，是结构定的。",
  check_label:"用主网真实 Agent ID 注册表，查任意地址",
  check_btn:"是真人吗？",
  check_try:"试试已知持有者：",check_sample_mask:"9nosing.ai 的 Agentic Wallet 地址（演示中不显示）", check_try_link:"9nosing.ai 的钱包", check_try2:"——也可以粘贴你自己的 Agentic Wallet 地址。",
  stat_campaigns:"主网上的活动", stat_entries:"真人报名人次",
  
  demo_h:"不用连钱包，看闸门怎么工作", demo_sub:"对着 BNB 主网真实的 Agent ID 注册表实弹演示。先放一群机器人进场，再放一个真人\u2014\u2014同一个入口，同一行检查。",
  demo_btn_bots:"放 100 个机器人进场", demo_btn_human:"放 1 个真人进场", demo_btn_reset:"重置",
  demo_c_try:"尝试进场", demo_c_pass:"通过", demo_c_reject:"被拒",
  demo_stage:"演示抽奖 \u2014 进场闸门", demo_empty:"还没有人试过这道门。选一边开始。",
  demo_checking:"查注册表中\u2026", demo_rejected:"被拒 \u00b7 注册表查无此人", demo_passed:"通过 \u00b7 已发 1 号票",
  demo_bot_tag:"机器人", demo_human_tag:"真人 \u00b7 样例持有人",
  demo_cap0:"机器人输的不是手速、预算或数量\u2014\u2014是注册表里根本没有它们。",
  demo_cap_bots:"100 个全新地址，100 次注册表查询，0 个查到。在链上，这每一次进场都会在碰到奖池之前就 revert NotHuman。",
  demo_cap_human:"一个地址，查一次，立刻查到。全部诀窍就在这里：闸门问的是注册表，不是人群。",
  demo_note:"本演示实时读取 BNB 主网 Agent ID 注册表；机器人地址由你的浏览器本地随机生成，从未持有过 Agent ID。",
  demo_err:"注册表读取失败（RPC 繁忙），请重置后重试。",
  t1_no:"01 / 活动", t1_h:"用你的唯一 ID 报名", t1_p:"正在进行的抽奖与投票，全部由 BeCounted 把关。一个 Agent ID 一张票——重复报名和第二个钱包都会在链上被拒。", t_go:"进入 →",
  t2_no:"02 / 原理", t2_h:"两个问题，两把钥匙", t2_p:"为什么门禁本身无状态、为什么去重状态归每个活动自己管，以及 BeCounted 永远不会做的三件事。", t_go2:"查看 →",
  t3_no:"03 / 开发者", t3_h:"一次只读调用就是 API", t3_p:"合约地址、接入代码片段，以及任何 AI Agent 动手前都能先跑一遍的 is-human 技能。", t_go3:"接入 →",
  foot_l:"BeCounted——为币安钱包 × BNB 链 Agent ID 黑客松而建。代币奖品由合约全额托管、中奖者链上自助领取；链下奖品由发起人按中奖名单发放。链负责证明谁报了名、谁中了奖。",
  foot_r:"主网已上线 · 币安钱包 × BNB 链 Agent ID 黑客松",
  v_invalid_t:"无效", v_invalid:"这不是一个钱包地址。",
  v_reading:"正在读取注册表…",
  v_yes_t:"唯一真人", v_yes:"持有 Agent ID——这个地址背后恰好站着一个 KYC 锚定的真人。",
  v_yes_s:"唯一性已证明。可不可信，仍然要你自己判断。",
  v_no_t:"未验证", v_no:"这个地址没有 Agent ID——过不了这道门。",
  v_no_s:"Agent ID 在 Agentic Wallet 里。确认你粘贴的是那个地址，而不是主钱包。",
  v_err_t:"出错", v_err:"注册表读取失败——稍等片刻再试。",
  kick_camp:"BNB 主网运行中",
  h_camp:"活动",
  camp_sub:"下面每一次报名都通过了 BeCounted 的核验。合约读取 BNB 主网真实 Agent ID 注册表，任何持有者都能报名。",
  loading:"正在从链上加载活动…", load_fail:"暂时连不上 BNB 主网——稍后刷新。", no_camp:"暂无活动。",
  c_raffle:"抽奖", c_vote:"投票", c_live:"进行中", c_ended:"已结束", c_upcoming:"未开始", c_drawn:"已开奖",
  c_window:"时间", c_winners:"中奖名额", c_options:"选项数",
  c_entries:"人已报名", c_winner:"中奖者：", c_enter:"报名抽奖", c_draw:"立即开奖",
  c_opt:"选项", c_vote_btn:"投",
  m_connect_first:"先连接钱包（右上角）。参加需要 Agentic Wallet 里的 Agent ID。",
  m_signing:"等待签名…", m_done:"完成——刷新中…",
  m_nowallet:"没找到钱包——请在钱包浏览器里打开本页，或安装 MetaMask。",
  m_connected:"已在 BSC 主网连接：", m_rejected:"连接被拒绝或失败。", m_wrongnet:"已连接，但钱包不在 BSC 主网——参加活动前请先切换到 BSC 主网。", m_pending:"钱包里已有一个待确认的请求——请先打开钱包把它处理掉。", m_disconnected:"已断开连接。", nav_switch:"切换账号", nav_exit:"退出连接", m_checking:"正在校验真人资格…", m_waiting:"已发送，等待上链确认…", m_need_human:"这个地址还没有 Agent ID，暂时参加不了。先在币安 App 里领取 Agent ID（见下方指南）。", f_live_only:"只看进行中", qr_h:"名片二维码", qr_sub:"扫码打开这张名片", cert_btn:"生成验奖图", cert_entries:"参与", cert_winners:"中奖", cert_each:"每人", cert_recompute:"任何人可在活动页复算本次开奖", cert_done:"验奖图已下载。", mine_joined_h:"我参加的活动", j_mystatus:"我的状态", j_entered:"已参加", j_notwon:"未中奖", j_winner:"中奖了，去活动页领奖", j_won_claimed:"奖金已领", j_voted:"已投票", j_claimed:"已领取", j_none:"你还没有参加过活动。", d_show_all:"显示全部", cd_sec:"4 · 参加条件（可选）", cd_bind:"必须已绑定 X 账号", cd_token:"持币门槛", cd_721_hint:"NFT 门槛这样设：上面地址填 NFT 合约，数字填至少持有几个（一般填 1）。参加时合约查 balanceOf，返回他持有几个，够数放行。", cd_721:"这是 NFT（按余额计数）", cd_prior:"必须参加过活动编号 #", cd_stamps:"必须持有远征印记 ≥", cd_hint:"条件在参加时由链上逐条检查。「关注」无法链上验证——绑定条件是它的无信任版本：每位参加者都带着公开账号，任何人可在 X 上对照核对。", cd_err_token:"请填入有效的门槛代币地址。", cd_err_min:"请填入大于零的最低持有量。", cd_err_prior:"请填入前置活动的编号。", cd_err_stamps:"印记门槛需在 1 到 7 之间。", chip_bind:"已绑定 X", chip_token:"持币", chip_nft:"NFT", chip_prior:"参加过", chip_stamps:"印记", m_cond_0:"本活动要求先绑定 X 账号——去身份卡页绑定后再来。", m_cond_1:"你持有的门槛代币不足，暂时参加不了本活动。", m_cond_2:"本活动只对老参加者开放——先去参加前置活动。", m_cond_3:"你的远征印记还不够，集满门槛再来。", chip_allow:"名单制", chip_id:"Agent ID 名单", m_cond_5:"本活动限名单内 Agent ID 参加——你的 Agent ID 不在名单内（或你的地址没有 Agent ID 名字）。若你有名字名单，先到活动详情页导入再参加。", cd_id:"Agent ID 名单——只有名单内的 Agent ID 能参加", cd_id_list:"Agent ID 名单", cd_id_ph:"每行一个 Agent ID 名字（带不带 .ai 都行）", cd_id_dl:"下载名单文件", cd_err_id:"名单为空或含有无效名字。", cd_id_hint:"名单存的是名字本身的哈希——名单里只有身份、没有钱包地址。名字写错不会报错，只是永远没人能对上，请逐个核对。", idlst_h:"Agent ID 名单", idlst_hint:"本活动限名单内 Agent ID 参加。名单以名字哈希的默克尔根存入合约——只有身份、没有钱包地址。导入名字名单即可核对你的名字并参加。", idlst_ph:"把 Agent ID 名字名单粘贴到这里", idlst_in:" · 你的 Agent ID 在名单内 ✓", idlst_out:" · 你的 Agent ID 不在名单内", idlst_nohandle:" · 你的地址没有 Agent ID 名字", m_cond_4:"本活动是名单制——先到活动详情页导入名单文件再参加。", cd_allow:"名单制——只有名单内的地址能参加", cd_allow_list:"地址名单", cd_allow_ph:"每行一个地址(或用逗号分隔)", cd_allow_dl:"下载名单文件", cd_err_allow:"名单为空或含有无效地址。", lst_h:"参加名单", lst_hint:"本活动限定名单内地址参加,名单的默克尔根已存入合约。导入名单即可核对你的地址并参加。", lst_ph:"把地址名单粘贴到这里", lst_save:"保存名单", lst_in:" \u00b7 你的地址在名单内 \u2713", lst_out:" \u00b7 你的地址不在名单内", lst_root_ok:"名单与链上根一致 \u2713", lst_root_bad:"这份名单与链上根不一致 \u2717", vp_on:"给投票加奖池(在投票人中抽奖)", vp_note:"投票结束后,从全部投票人中随机抽取中奖者——投了哪个选项不影响抽奖——平分奖池。中奖者链上自助领取,任何人可复算开奖。", vp_total:"奖池总额", vp_winners:"中奖名额", vp_err_token:"请为投票奖池选择奖品代币。", vp_err_total:"请填入大于零的奖池金额。", c_vote_prize:"投票奖池", nav_quest:"远征", q_kicker:"创世远征 \u00b7 第 0 季", q_title:"真人远征", q_sub:"七天，七枚印记，一场终章。只有真人能集印——每天一枚，拼手气即时到账。集满至少 5 枚，即可进入终章抽奖。", q_stat_daypool:"每日印记池", q_stat_slots:"每日名额", q_stat_finale:"终章奖池", q_stat_min:"终章门槛（印记）", q_my_h:"我的远征", q_day:"第", q_today_claim:"领取今日印记", q_today_done:"今日已集", q_today_full:"今日名额已领完", q_today_left:"今日剩余", q_notstarted:"赛季开始于", q_connect_hint:"连接钱包后参与。", q_skill_hint:"持有 Agent ID？Agentic Wallet 无法连接网站——请通过你的 Agent 用参与 Skill 加入：", q_skill_link:"打开参与 Skill", q_finale_h:"终章", q_enter:"进入终章", q_entered:"已进入终章", q_need_more:"还差印记", q_eligible_yes:"已获终章资格", q_genesis:"创世参与", q_seed_lock:"锁定开奖种子", q_draw_btn:"终章开奖", q_drawn_h:"终章已开奖", q_claim_prize:"领取奖金", q_prize_claimed:"奖金已领", q_entries_h:"终章参加者", q_phase_entry:"报名截止", q_winner_tag:"中奖", q_rules_h:"玩法", q_rules_1:"每位真人每天可领一枚印记，每枚按拼手气分当日池，即时到账。", q_rules_2:"7 枚集满至少 5 枚可进入终章，报名一人一份。", q_rules_3:"终章种子在报名截止后链上锁定，任何人可复算中奖名单。印记随机为娱乐级伪随机——每日小额，设计如此。", q_card_h:"远征 · 第 0 季", m_switch_hint:"当前钱包不支持在这里切换，请在钱包内切换账号后刷新页面。", prof_h:"个人主页", prof_self:"自述 \u00b7 已上链", prof_edit_h:"编辑我的主页资料", prof_bio:"一句话简介", prof_bio_ph:"用一句话介绍你自己", prof_title_ph:"标题，如：X", prof_url_ph:"https://\u2026", prof_save:"保存上链", prof_remove:"删除资料", prof_saved:"资料已上链保存。", prof_removed:"资料已删除。", prof_note:"简介与链接由本人填写并存于链上，属于自述内容、未经验证。",
  kick_how:"设计", h_how:"两个问题。两把钥匙。",
  how_sub:"抗女巫其实是两个不同的问题。多数系统把它们塞进同一个数据库、同一把管理员钥匙。我们把它们彻底分开——这个分离，就是全部设计。",
  q1_k:"问题一——每次调用都要问", q1_h:"「这个地址背后，是不是一个唯一真人？」",
  q1_p:"用 <code>地址</code> 作钥匙。由 BeCounted 原语回答：对 Agent ID 注册表做一次只读查询，<code>isHuman(address) → bool</code>。无状态、只读、无 owner、不可升级。部署一次，永不再动——任何人都能在链上验证这一点。",
  q1_who:"回答者 →", q1_who_b:"BeCounted（原语）",
  q2_k:"问题二——每个活动只问一次", q2_h:"「这个人，在这个活动里算过没有？」",
  q2_p:"用 <code>Agent ID</code> 作钥匙。由每个活动自己的账本回答——状态归调用方，不进原语。因为 Agent ID 不可转让、只存在于一个钱包里，按持有地址去重，就等于按 ID 本人去重。",
  q2_who:"回答者 →", q2_who_b:"每个活动合约（调用方）",
  bounds_h:"三条线，我们不越",
  b1_x:"绝不 — 01", b1_h:"不做反查", b1_p:"我们回答「地址 → 是不是真人」，但不向任何人提供「名字 → 钱包」的查询。门是用来把关的，不是用来监视的。唯一内部使用，是持有人本人申请绑定登记时用一次——不展示、不保存。",
  b2_x:"绝不 — 02", b2_h:"不判人品", b2_p:"Agent ID 证明的是「同一个人、且只有一个」，不是「这个人可信」。可问责，不等于可信。",
  b3_x:"绝不 — 03", b3_h:"不查小号", b3_p:"我们不聚类、不打分、不曝光任何人的其他地址。多余的地址过不了门——这就够了。",
  why_h:"为什么是原语，不是平台",
  why_p:"平台握着你的数据，要求你信任它。原语什么都不握：没有数据库、没有管理员钥匙、没有关停开关。Ptah 的 Proof of Agent 抽奖和一批「一人一份」的 Mint 已经在手工查 Agent ID 注册表了——BeCounted 把这个被验证过的模式，做成任何合约、任何 Agent 都能复用的一次调用。",
  kick_build:"接入", h_build:"开发者",
  build_sub:"一次只读调用，就是全部接入工作。你的合约只要能调 view 函数，就拥有了抗女巫能力。",
  code_note:"一行代码给任何函数加门。原语无状态——去重状态由你的合约按「人」自己记。",
  a_gate:"BeCounted — BSC 主网", a_apps:"OneIDCampaigns — BSC 主网", a_bind:"绑定登记合约", a_quest:"QuestPass — BSC 主网", a_reg:"Agent ID 注册表 — BSC 主网", a_skill:"Agent 技能",
  a_skill_v:"is-human——零依赖的小工具，任何 AI Agent 在动手之前都能先跑一遍。源码在项目仓库里。",
  a_profile:"个人主页资料（简介 + 链接）", embed_h:"把查真人嵌入你的网站", embed_p:"两行代码就能把实时查真人放到任何网页上：直读注册表、无需密钥、无需后端、纯只读。链上门禁请用上方的合约接口或模板。",
  nav_white:"白皮书", kick_wp:"白皮书", h_wp:"BeCounted 白皮书", wp_sub:"它是什么、怎么工作、拒绝做什么、局限在哪里——一页说清。",
  wp1_h:"论点：地址是运输工具，身份才是人", wp1_p:"女巫攻击不是验证问题，是结构问题：造地址免费，任何按地址收费的防御最终都会输。Agent ID 换了计量单位——一次 KYC、一个 ID、不可转让。BeCounted 把这个事实变成任何合约都能问的一句话：isHuman（地址）。",
  wp2_h:"两键原则", wp2_p:"第一把钥匙——「这是不是唯一的真人」——按地址问、每次都问、由原语回答。第二把钥匙——「这个人这次活动算过没有」——按持有者记、状态存在调用方那里。原语本身什么都不存：没有名单、没有分数、没有历史。这是刻意的——一道什么都不记的门，没有可泄露、可出售、可滥用的东西。",
  wp3_h:"三条边界", wp3_p:"三条拒绝，写进设计：不反查（不提供名字→钱包的查询、不向任何人展示解析结果；唯一内部使用是持有人本人申请绑定登记时用一次，不展示、不保存）、不判人品（门只证明「同一个人」，从不证明「可信」）、不查小号（不聚类、不贴标签）。每条拒绝都放弃了一门本可做的生意——换来的是我们回答的那个问题始终干净。",
  wp4_h:"安全模型", wp4_1:"门禁只读：一个 view 函数，无 owner、不可升级、没有暂停开关。没人能改它的答案，包括我们自己。", wp4_2:"奖品在活动创建时就托管进活动合约。中奖者自助领取；30 天无人领的奖金才退回创作者。", wp4_3:"开奖可复算：活动结束后，任何人都能在链上锁定种子——锁定后第 2 个区块的哈希，报名已关闭、无人能提前知道——任何人都能用公开数据重算中奖名单，活动页一键就能验。", wp4_4:"诚实的随机：拼手气用的是区块哈希伪随机，合约与页面都明示为娱乐级，只适合小额奖池。", wp4_5:"网站从不要无限授权：代币托管只批准确切金额、只批一次。",
  wp5_h:"按比赛安全红线建造", wp5_p:"不在第三方站点做 Agentic Wallet 登录（参与由用户自己的 Agent 逐笔确认完成——Agentic Wallet 不连接本站或任何第三方网站）；没有静默或捆绑转账；没有无限授权；合约开源且 owner 权限如实披露——答案是：没有；任何名称不冒充币安或 BNB；永不收集助记词、私钥或配对码。我们自己的 Agent 工具按设计就是只读的。",
  wp6_h:"已知局限", wp6_1:"门的供给并不窄：Agent ID 持有人已超 26.3 万（2026 年 11 月注册表数据），且仍在增长。真正的局限是触达——绝大多数持有人没听说过任何一场具体的门禁活动，每场活动仍要从零开始找人。合约不用改，要变的是被看见的程度。", wp6_2:"唯一性的上限是 KYC，不是数学：一个人有多个实名身份，就可能有多个 ID。我们声称的是「一个身份一份」，不是「一个灵魂一份」。", wp6_3:"若币安重构或更换 Agentic Wallet，ID 如何迁移由币安决定，不由我们。我们的定位更窄、也更诚实：一个已被验证的模式的第一个可用接口——不是「标准」。",
  wp7_h:"合约地址", wp7_p:"当前运行于 BSC 主网；地址已在 BscScan 验证。", wp8_h:"标志", wp8_1:"中央是真人。BeCounted 验的始终只有一件事——参加者是不是独一无二的真人；所以人站在最前面，其余一切为他服务。", wp8_2:"人身后交叉着两把钥匙，如侠客背后的双剑，即两键原则。一把回答「是不是唯一的真人」，每次参加都查；一把回答「这个人算没算过」，每场活动只数一次。两把钥匙守的是公平：一人一次，机器人进不来。", wp8_3:"金盘是一枚印。被数上，即为印记——每位被数上的参与者，都带着这同一枚印。金色是所建生态的颜色；圆，取一个不多、一个不少之意。",
  skill_h:"不只给合约，也给 Agent",
  skill_p:"同一套核验也做成了技能：AI Agent 在报名、领取或付款之前，可以先问一句「这个地址背后是不是唯一真人？」——答案的证据在链上，不由我们签发，也不经我们存储。",
  kick_card:"只读身份", h_card:"身份卡",
  card_sub:"一个已验证真人，在门的另一侧长什么样。由你的浏览器直接读链生成——不存储、不追踪。",
  card_btn:"生成", card_lbl:"BECOUNTED · 身份卡", card_not:"未查询", card_reading:"读取中…", card_fail:"读取失败",
  card_yes:"✓ 唯一真人", card_no:"无 AGENT ID",
  card_note0:"输入地址，从 BNB 主网注册表读取它的 Agent ID 状态。这张卡证明唯一性与连续性——同一个人、且只有一个。它不说明这个人是否可信。",
  card_note_yes:"这个地址在 BNB 链上持有 Agent ID：一个已验证真人、一个身份，不可转让、只绑定一个 Agentic Wallet。在任何接入 BeCounted 的活动里，它都只能被计算一次——在这里如此，在所有用这道门的地方都如此。",
  card_note_no:"这个地址没有绑定 Agent ID。它可能只是个普通钱包，或者地址贴错了——Agent ID 在币安 App 里创建的 Agentic Wallet 里。",
  card_invalid:"这不是有效的地址",
  nav_create:"发布活动",
  nav_mine:"我的活动",
  share_btn:"分享", c_option:"选项", m_draw:"立即开奖", m_drawn:"已开奖", tx_fail:"交易失败", post_btn:"发行人的帖子", post_set:"X 帖子链接", post_ph:"粘贴帖子链接（https://x.com/…）", post_save:"保存链接", f_posturl:"你的 X 帖子链接（选填，可稍后补）",
  nav_bind:"绑定 X",
  flt_search_ph:"搜索活动…", flt_all:"全部", flt_live:"进行中", flt_upcoming:"未开始", flt_ended:"已结束",
  d_details:"详情", d_participants:"参与者", exp_btn:"导出名单 CSV", d_winners:"中奖名单", d_back:"全部活动",
  d_proof_h:"开奖证明 — 自己验一遍", d_proof_seedblock:"种子区块",
  d_proof_fallback:"用了备用种子（原种子区块已过期）", d_proof_verify:"复算中奖名单",
  d_proof_ok:"复算结果与链上中奖名单完全一致。", d_proof_bad:"对不上——这次开奖不可信。",
  d_proof_how:"中奖者由部分 Fisher–Yates 洗牌决定：第 i 个名额 j = i + keccak256(种子, i) 对 (n − i) 取模，按报名顺序在名单上换位。任何人都能重算这笔账。",
  d_notdrawn:"尚未开奖——结束时间过后，任何人都能先锁定开奖种子、再触发开奖。",
  d_notfound:"这个活动还不存在——可能是测试网链接，或编号输错了。",
  d_lock_seed:"锁定开奖种子", d_lock_hint:"种子 = 锁定后第 2 个区块的哈希。报名已关闭，无人能预测——任何人都可以锁定。",
  d_seed_wait:"种子已锁定——等待种子块出块", d_seed_block:"种子块", d_cur_block:"当前块",
  d_relock_seed:"种子已过期，重新锁定", d_seed_expired:"锁定的种子块已超过 256 块有效期，重新锁定一个即可开奖。",
  m_err_claim_expired:"已超过 30 天领取期，这份奖金不能再领了。",
  m_err_insufficient:"奖品代币实际到账金额不符——带转账税的代币不能用作奖品，请换标准代币或 BNB。",
  m_err_seed_notlocked:"开奖种子还没锁定——先锁定种子再开奖。", m_err_seed_expired:"锁定的种子已过期——重新锁定后即可开奖。", m_err_seed_locked:"开奖种子已经锁定且仍在有效期内。",
  bind_kick:"社交绑定", bind_h:"绑定你的 X 账号",
  bind_sub:"一份公开可验的声明——不是信誉分。它只证明这个 X 账号和这个钱包是同一个人，仅此而已。推文本身就是记录；没有数据库。绑定公开的是你的 X 账号与这个地址的对应关系，这正是它的用途；你的 Agent ID 也不会被拿去给任何人查钱包：只有你本人要求登记时，你自己的 Agent 才会在内部解析一次、复算验证码并完成登记——项目方不解析、不展示、不保存。",
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
    warn_token: "\u81ea\u5b9a\u4e49\u5956\u54c1\u4ee3\u5e01\u2014\u2014\u5176\u4ef7\u503c\u4e0e\u53ef\u8f6c\u8ba9\u6027\u672a\u7ecf\u9a8c\u8bc1\uff0c\u53c2\u52a0\u524d\u8bf7\u81ea\u884c\u6838\u67e5\u8be5\u4ee3\u5e01\u5408\u7ea6\u3002",
    d_contract: "\u5408\u7ea6",
    hero_cta_join: "\u53c2\u52a0\u6d3b\u52a8",
    hero_cta_create: "\u521b\u5efa\u6d3b\u52a8",
    bind_bound: "\u5df2\u94fe\u4e0a\u7ed1\u5b9a",
    bind_register: "\u628a\u7ed1\u5b9a\u767b\u8bb0\u5230\u94fe\u4e0a",
    bind_registered: "\u767b\u8bb0\u6210\u529f\u2014\u2014\u4f60\u7684\u6d3b\u52a8\u5361\u7247\u4e0a\u4f1a\u663e\u793a @\u8d26\u53f7\u4e86\u3002",
    bind_need_sig: "\u5148\u5728\u7b2c\u4e8c\u6b65\u751f\u6210\u7b7e\u540d\u3002",
    bind_onchain: "\u8be5\u7ed1\u5b9a\u5df2\u5728\u94fe\u4e0a\u767b\u8bb0",
  bind_self_h:"绑定 Agentic Wallet 地址（自助登记）", bind_self_sub:"Agentic Wallet 不能签消息，走不了上面的签名流程。改走自助登记：用你的 X 账号发一条写明 X 账号和 Agent ID 名的推文（不写地址），再把推文链接交给你自己的 Agent——它审核后用你的钱包直接上链登记，通常一两分钟绑好。推文的 ID 会存上链作存证，这条声明从此永久公开可查；登记完成后，推文删不删都不影响记录。两条如实的边界：账号侧是你以推文存证的声明，比签名弱、也会如实标注；每个地址 24 小时只能登记一次。绑定前先读这一句：登记会把你的 X 账号与这个地址的对应关系永久公开在链上，任何人都能按地址查到；只绑你愿意公开关联到 X 账号的地址。", bind_self_make:"生成我的验证推文", bind_self_post:"去 X 发推", bind_self_note:"发完推后，复制下面这段话、在末尾补上你的推文链接，交给你的 Agent（操作你 Agentic Wallet 的那个）。它会审核这条推文——作者、原文、以及用你钱包地址复算的验证码——然后用你的钱包上链登记。没有登记员，不用排队。登记后在这里查状态。", bind_self_cmd:"帮我登记 BeCounted 的 X 绑定。按 BeCounted Skill 的自助登记章节执行（https://becounted.9nosing.com/becounted-skill.md）。我的验证推文：", bind_self_copy:"复制这段话", bind_self_check:"查登记状态", bind_self_none:"这个地址还没有登记绑定。", bind_self_sig:"已登记——签名证明。", bind_self_proof:"已登记——自助登记（推文存证）。", bind_self_tag:"自助登记", bind_agentic_ph:"0x…（Agentic Wallet 地址）", bind_f_agent:"Agent ID 名", bind_agent_ph:"如 name.ai", bind_self_addr_note:"只在本页本地计算验证码用，不会出现在推文里，也不会上传到任何地方。",
    card_copy_link: "\u590d\u5236\u540d\u7247\u94fe\u63a5",
    series_set: "\u8bbe\u7f6e\u7cfb\u5217",
    series_ph: "\u7cfb\u5217\u6807\u7b7e\uff0c\u5982\uff1a\u7b2c\u4e8c\u671f",
    f_series: "\u7cfb\u5217\u6807\u7b7e\uff08\u9009\u586b\uff09",
    series_all: "\u5168\u90e8\u7cfb\u5217",
    poster_btn: "\u751f\u6210\u6d77\u62a5",

  stat_humans:"已验证真人", stat_payouts:"已发放笔数",
  
  
  
  card_img_btn:"生成我的晒卡", card_img_dl:"下载 PNG", card_img_share:"发推晒卡",
  card_img_share_text:"我在 BeCounted 已验证为唯一真人——一个 KYC、一个 Agent ID、零机器人。查查你自己的地址：",
  img_verified:"已验证 · 唯一真人", img_entries:"参与", img_wins:"中奖", img_claims:"领取",
  creator_kick:"创作者", creator_h:"创作者主页", creator_camps:"个活动", creator_entries:"总参与人次",
  creator_none:"这个地址还没有发起过活动。",
  creator_by:"发起人",

  share_text_raffle:"我刚在 BeCounted 参加了《{title}》——一人一个 Agent ID、一张票，机器人农场进不来，每个名额都是验证过的真人。一起来：",
  share_text_vote:"我刚在 BeCounted 的《{title}》投了一票——一个 Agent ID 一票，女巫刷不了票。你也来表个态：",
  share_text_claim:"我刚在 BeCounted 的《{title}》领到了我那一份——一个 Agent ID 一份，链上即时到账。你也来领：",
  share_text_win:"我在 BeCounted 的《{title}》中奖了，奖品已在链上领到——一人一票、开奖可复算。下期一起：",
  share_done_hint:"搞定！发条推晒一下——带 #BinanceWalletHackathon #AgenticWallet 的原创推还有机会拿官方 100 USDC 社区奖（记得去官方表单登记帖子链接才算参赛）：",
  guide_h:"还没有 Agent ID？去币安 App 领一个，大约 3 分钟",
  guide_1:"打开币安 App，进入钱包",
  guide_2:"点钱包首页的 Agent ID 横幅",
  guide_3:"领取你的 name.ai——一个 KYC 一个、免费（备一点点 BNB 付 gas）",
  guide_4:"用 BeCounted 参与 Skill 让你的 Agent 代你参加——Agent ID 本身不直连网站",
  join_h:"已有 Agent ID？让你的 Agent 代你参加——三步",
  join_1:"把 BeCounted 参与 Skill 发给你的 Agent（下方按钮）",
  join_2:"对它说一句人话：「帮我参加 BeCounted 创世抽奖」",
  join_3:"Agent 会先预览这笔调用，你确认一次即可——交易从你自己的 Agentic Wallet 地址发出",
  join_note:"赛季活动不需要绑定 X、不需要提前注册，地址本身就是身份。",
  join_btn:"打开参与 Skill →",
  pskill_note:"持有人也是这样参加的——派自己的 Agent 来。参与 Skill 就是给它的指令文件：它替你参加赛季活动，每笔调用都先预览、等你确认。",
  pskill_link:"BeCounted 参与 Skill →",
  nav_skill:"参与 Skill",
  kick_skill:"持有人指南", h_skill:"参与 Skill，一页读完。",
  skill_sub:"这是你的 Agent 代你参加 BeCounted 活动时遵循的指令文件。在这里直接读——或者复制下方链接发给你的 Agent，它读的是同一份源文件。",
  skill_copy_btn:"复制 Skill 链接", skill_copied:"Skill 链接已复制——发给你的 Agent 吧", skill_copy_fail:"复制失败——原始链接在本页底部",
  skill_loading:"正在加载 Skill…", skill_raw_note:"源文件——你的 Agent 读的就是这一份：", skill_raw_open:"打开原始 Skill 文件 →",
  pskill_raw:"给 Agent 的原始文件：becounted-skill.md",
  home_skill_banner:"已有 Agent ID？把参与 Skill 发给你的 Agent，它替你参加 →",
  camp_skill_hint:"持有人：", camp_skill_link:"可用自己的 Agent 参加 → 参与 Skill",
  cd_ends:"距结束", cd_starts:"距开始", cd_d:"天", cd_h:"小时", cd_m:"分",
  soon_h:"即将结束", soon_sub:"正在进行、先到截止时间的排前面——别错过窗口。",
  hot_h:"热度榜", hot_camps:"热门活动", hot_creators:"创作者榜", hot_entries:"人参与",
  f_tok_usdt:"USDT \u00b7 {chain}（预设）", f_tok_usdc:"USDC \u00b7 {chain}（预设）", f_tok_custom:"自定义奖品（链下发放）", f_chain_main:"BSC 主网", f_chain_test:"BSC 测试网",
  f_prize_label:"奖品说明（存上链）", f_prize_label_ph:"如：合作方白名单名额 \u00d71", f_custom_hint:"链下奖品不由合约托管。中奖名单在链上开奖产生，奖品由你按名单自行发放。", f_err_label:"请填写自定义奖品说明（1\u201380 字节）。", c_custom_tag:"链下奖品", d_custom_note:"链下奖品\u2014\u2014由发起人按中奖名单发放，合约不托管。", d_custom_claim:"你中奖了\u2014\u2014奖品由发起人链下发放。",

  c_claim:"领取", c_pool:"奖池", c_each:"每份", c_claimed_n:"已领", c_claim_btn:"领取",
  c_prize:"奖品", c_claim_prize:"领取奖品", c_prize_claimed:"奖品已领取",
  ev_claimed:"领取了一份", ev_prize:"领取了奖品",
  f_tab_claim:"领取活动",
  f_mode:"发放方式", f_mode_fixed:"固定金额", f_mode_random:"拼手气（随机）",
  f_mode_hint:"拼手气用二倍均值法：每次领取在保底和剩余平均值两倍之间随机，最后一位拿走剩余。金额由链上伪随机决定——适合小额娱乐局。",
  c_lucky:"拼手气",

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
  feed_h:"门边的实时动态 — BSC 主网", feed_blk:"区块",
  ev_created:"新建了活动", ev_entered:"报名了抽奖", ev_voted:"投了一票", ev_drawn:"抽奖已开奖",
  feed_empty:"最近还没有事件。", feed_fail:"动态暂时不可用。",
  cta_h:"办你自己的抽奖——只认真人",
  cta_p:"任何人都能在这里发起抽奖或投票。每次报名先过 Agent ID 的链上核验：一个真人一个名额，工作室、机器人一个都进不来。你出奖品、你带人，公平交给合约。",
  cta_btn:"发起一个活动",
  kick_create:"对所有人开放", h_create:"发起活动",
  create_sub:"无需许可、没有上架费，代币奖品全额托管进合约。设置好、把链接发出去，每一次报名都会自动过一遍 Agent ID 核验。",
  f_title:"标题", f_title_ph:"例如：社区空投抽奖 — 20 USDC",
  f_start:"开始时间", f_end:"结束时间", f_winners:"中奖人数",
  f_options:"选项数量（2–16）", f_opt_labels:"选项文字", e_opt_label:"请把每个选项的文字都填好（每个 1–60 字节）。",
  f_seed_hint:"创建时不设种子。活动结束后，任何人都能在链上锁定开奖种子——锁定后第 2 个区块的哈希；此时报名已关闭，无人能提前知道。开奖结果任何人可复算。",
  f_prize_hint:"奖品在创建时全额托管进合约，中奖者链上自助领取；30 天未领的部分可由你回收。",
  f_submit_raffle:"创建抽奖", f_submit_vote:"创建投票",
  f_tab_raffle:"抽奖", f_tab_vote:"投票",
  f_err_title:"给活动起个标题。", f_err_time:"结束时间必须晚于开始时间，开始时间不能是过去。",
  f_err_winners:"中奖人数至少为 1。",
  flt_empty:"没有符合条件的活动，换个筛选试试", flt_clear:"清除筛选",
  rec_prompt:"输入地址，查看它的参与记录",
  j_connect:"先连接钱包，才能看到你参加的活动。",
  bind_f_x:"X 账号", bind_f_addr:"地址", bind_f_sig:"签名",
  err_read:"读不到本活动的参加条件——检查网络后重试。",
  stat_fail:"暂不可用",
  f_ok:"活动创建成功——已经出现在活动页了。快分享出去！",
  f_creating:"正在上链创建…",
  kick_ci:"每日签到 · 活跃权重", h_ci:"每日签到",
  ci_sub:"每位真人每天签到一次——由 Agent ID 门禁、链上记录。近 30 天内的签到天数决定你的活跃权重：<b>权重 = 1 + 天数</b>。任何人都能从事件日志独立复算。",
  ci_bj:"北京时间",
  ci_status_connect:"连接钱包后查看你的签到状态。",
  ci_status_ready:"你今天还没有签到。",
  ci_status_done:"今日已签到 ✓——明天见。",
  ci_stat_total:"累计签到", ci_stat_window:"近 30 天签到", ci_stat_weight:"我的权重",
  ci_weight_formula:"权重 = 1 + 近 30 天签到天数 · 超过 30 天的签到滑出窗口",
  ci_stat_next:"下次签到开启倒计时", ci_btn:"签到", ci_btn_done:"已签到 ✓",
  ci_not_holder:"这个钱包没有 Agent ID，不能签到。签到只对 Agent ID 持有人开放——一人一号、每天一次。",
  ci_note_agent:"你的 Agent ID 在 Agentic Wallet 里？它连不上网站——让你的 Agent 用参与 Skill 替你签到：",
  ci_note_link:"打开参与 Skill",
  ci_soon_h:"签到即将开放",
  ci_soon:"签到合约尚未在此网络上线。部署完成的那一刻，本页会自动开放——无需更新。",
  ci_board_h:"活跃榜",
  ci_board_sub:"按累计签到天数排序，数据直接来自链上的 CheckedIn 日志。这里只显示截断地址——在本站，名字永不与地址同屏。",
  ci_col_addr:"地址", ci_col_days:"累计天数", ci_col_weight:"权重",
  ci_board_empty:"还没有人签到——来做第一个。",
  ci_board_loading:"正在读取签到日志…",
  ci_board_fail:"暂时读不到签到日志——稍后再试。",
  ci_done_toast:"签到成功——明天见。",
  ci_err_already:"今天已经签过到了。",
  ci_err_nothuman:"这个钱包没有 Agent ID，过不了真人门禁。",
}};

let LANG = localStorage.getItem("hg-lang") || ((navigator.language || "en").startsWith("zh") ? "zh" : "en");
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
window.__HG_DICTS = I18N;

function applyI18n(){
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll(".lang button").forEach(b => { const on = b.dataset.lang === LANG; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  if (typeof window.__mqFill === "function") window.__mqFill();
  if (typeof window.onLangChange === "function") window.onLangChange();
}
function setLang(l){ LANG = l; localStorage.setItem("hg-lang", l); applyI18n(); }

const $ = id => document.getElementById(id);
let __toastTimer = null;
function toast(msg){ const el = $("toast"); if(!el) return; el.textContent = msg; el.classList.add("show"); if (__toastTimer) clearTimeout(__toastTimer); __toastTimer = setTimeout(()=>el.classList.remove("show"), 3400); }
function short(a){ return a.slice(0,6)+"…"+a.slice(-4); }
function escHtml(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function fmtTime(ts){ const d = new Date(Number(ts)*1000); return d.toLocaleString(LANG === "zh" ? "zh-CN" : "en-GB", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"}); }

let providerMain = null, providerTest = null, registry = null, appsRead = null, bindingsRead = null, profileRead = null, gateRead = null, questRead = null, checkinRead = null;
function chain(){
  if (!providerMain){
    const fb = (urls, chainId) => new ethers.FallbackProvider(urls.map(u => new ethers.JsonRpcProvider(u, chainId, { staticNetwork: true })), chainId, { quorum: 1 });
    providerMain = fb(NETWORK.mainRpcs, 56);
    providerTest = fb(NETWORK.appsRpcs, NETWORK.appsChainId);
    registry = new ethers.Contract(REGISTRY_MAINNET, ERC721_ABI, providerMain);
    appsRead = new ethers.Contract(APPS_TESTNET, APPS_ABI, providerTest);
    bindingsRead = new ethers.Contract(BINDINGS_TESTNET, BINDINGS_ABI, providerTest);
    profileRead = new ethers.Contract(PROFILE_TESTNET, PROFILE_ABI, providerTest);
    questRead = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, providerTest);
    gateRead = new ethers.Contract(GATE_TESTNET, GATE_ABI, providerTest);
    checkinRead = new ethers.Contract(CHECKIN_TESTNET, CHECKIN_ABI, providerTest);
  }
}

/* ---------- on-chain profile (bio + links, self-described) ---------- */
async function readProfile(addr){
  chain();
  try{
    const r = await profileRead.profileOf(addr);
    return { bio: r[0], links: r[1].map(l => ({ title: l[0], url: l[1] })), updatedAt: Number(r[2]) };
  }catch(e){ return null; }
}
async function loadProfile(addr){
  const box = $("profileBox"); if (!box) return;
  box.style.display = "none";
  const ed = $("profileEdit"); if (ed) ed.style.display = "none";
  const p = await readProfile(addr);
  if (p && (p.bio || p.links.length)){
    const bioEl = $("profileBio");
    bioEl.textContent = p.bio || "";
    bioEl.style.display = p.bio ? "" : "none";
    $("profileLinks").innerHTML = p.links.map(l => {
      const u = String(l.url), ttl = String(l.title).replace(/</g, "&lt;");
      // Only https:// URLs become links (same rule as campaign post URLs);
      // anything else renders as plain text, never as a clickable href.
      return u.startsWith("https://")
        ? `<a class="btn ghost sm" href="${u.replace(/"/g, "%22")}" target="_blank" rel="noopener" style="text-decoration:none">${ttl}</a>`
        : `<span class="btn ghost sm" style="opacity:.55;cursor:default">${ttl}</span>`;
    }).join("");
    box.style.display = "";
  }
  if (ed && myAddr && addr.toLowerCase() === myAddr.toLowerCase()){
    $("pfBio").value = p ? p.bio : "";
    for (let i = 0; i < 5; i++){
      const lk = p && p.links[i] ? p.links[i] : { title: "", url: "" };
      $("pfT" + i).value = lk.title; $("pfU" + i).value = lk.url;
    }
    ed.style.display = "";
  }
}
async function saveProfile(){
  const msg = $("pfMsg");
  try{
    await connectWallet();
    if (!signer){ msg.textContent = t("m_wrongnet"); return; }
    const bio = $("pfBio").value.trim();
    const links = [];
    for (let i = 0; i < 5; i++){
      const tt = $("pfT" + i).value.trim(), uu = $("pfU" + i).value.trim();
      if (tt || uu) links.push({ title: tt, url: uu });
    }
    const c = new ethers.Contract(PROFILE_TESTNET, PROFILE_ABI, signer);
    msg.textContent = t("m_signing");
    await (await c.setProfile(bio, links)).wait();
    msg.textContent = t("prof_saved");
    loadProfile(myAddr);
  }catch(e){ msg.textContent = ((e.shortMessage || e.message) || "").slice(0, 120); }
}
async function removeProfileFn(){
  const msg = $("pfMsg");
  try{
    await connectWallet();
    if (!signer){ msg.textContent = t("m_wrongnet"); return; }
    const c = new ethers.Contract(PROFILE_TESTNET, PROFILE_ABI, signer);
    msg.textContent = t("m_signing");
    await (await c.removeProfile()).wait();
    msg.textContent = t("prof_removed");
    loadProfile(myAddr);
  }catch(e){ msg.textContent = ((e.shortMessage || e.message) || "").slice(0, 120); }
}

/* ---------- checker + card (shared read) ---------- */
async function readHuman(addr){
  chain();
  return (await registry.balanceOf(addr)) > 0n;
}
async function readGateHuman(addr){
  chain();
  try{ return await gateRead.isHuman(addr); }catch(e){ return null; }
}
function toggleGuide(show){
  document.querySelectorAll(".claimGuide").forEach(g => g.style.display = show ? "" : "none");
}
let __checkSeq = 0;
async function checkAddress(addr, verdictEl){
  const seq = ++__checkSeq;
  if(!ethers.isAddress(addr)){ verdictEl.className = "verdict show no"; verdictEl.innerHTML = `<span class="tag">${t("v_invalid_t")}</span>${t("v_invalid")}`; return; }
  verdictEl.className = "verdict show"; verdictEl.innerHTML = t("v_reading");
  try{
    const human = addr.toLowerCase() === "0x0000000000000000000000000000000000000000" ? false : await readHuman(addr);
    if (seq !== __checkSeq) return; // a newer check superseded this one
    verdictEl.className = "verdict show " + (human ? "yes" : "no");
    verdictEl.innerHTML = human
      ? `<span class="tag">${t("v_yes_t")}</span>${t("v_yes")}<small>${t("v_yes_s")}</small>`
      : `<span class="tag">${t("v_no_t")}</span>${t("v_no")}<small>${t("v_no_s")}</small>`;
    toggleGuide(human === false);
  }catch(e){ if (seq !== __checkSeq) return; verdictEl.className = "verdict show no"; verdictEl.innerHTML = `<span class="tag">${t("v_err_t")}</span>${t("v_err")}`; }
}

/* ---------- wallet ---------- */
let signer = null, myAddr = null;
let myHuman = null, walletMenu = null;
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
            await window.ethereum.request({ method:"wallet_addEthereumChain", params:[{ chainId: NETWORK.appsChainHex, chainName:"BNB Smart Chain", nativeCurrency:{ name:"BNB", symbol:"BNB", decimals:18 }, rpcUrls:["https://bsc-dataseed.binance.org","https://bsc-rpc.publicnode.com","https://rpc.ankr.com/bsc","https://bsc-dataseed1.bnbchain.org","https://bsc-dataseed2.bnbchain.org"], blockExplorerUrls:["https://bscscan.com"] }] });
          } else throw swErr;
        }
      }
    }catch(chainErr){ // switch / add-chain failed: abort the connect instead of marching on with a signer on the wrong network
      toast(t("m_wrongnet")); signer = null; myAddr = null; myHuman = null; return; }
    renderConnectBtn();
    try{
      myHuman = await readHuman(myAddr);
      renderConnectBtn();
    }catch(e){}
    toast(t("m_connected") + myAddr);
    if ($("campGrid")) loadCampaigns();
    if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail(); if ($("questBox")) loadQuest();
  if ($("cardBtn") && !new URLSearchParams(location.search).get("a")) { $("cardInput").value = myAddr; $("cardBtn").click(); }
  }catch(e){
    if(e && e.code === -32002) toast(t("m_pending"));
    else toast(t("m_rejected") + " [" + ((e && (e.shortMessage || e.message)) || "unknown").slice(0, 110) + "]");
  }
}

/* Re-verify the wallet is still on the apps chain immediately before a
   send. connectWallet checks once at connect time, but a wallet can be
   switched afterwards (or its chainChanged event missed), and a
   transaction built on the wrong network then fails opaquely inside the
   wallet. Runs the same switch flow as connectWallet; a chain the wallet
   does not know yet (4902) is delegated to a full connectWallet, which
   owns the add-chain parameters. Returns true only when the wallet is on
   NETWORK.appsChainId; callers abort with t("m_wrongnet") otherwise. */
async function ensureWalletChain(){
  if (!window.ethereum || !signer) return false;
  try{
    const net = await new ethers.BrowserProvider(window.ethereum).getNetwork();
    if (net.chainId === BigInt(NETWORK.appsChainId)) return true;
    try{ await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: NETWORK.appsChainHex }] }); }
    catch(swErr){ await connectWallet(); }
    if (!signer) return false;
    const net2 = await new ethers.BrowserProvider(window.ethereum).getNetwork();
    return net2.chainId === BigInt(NETWORK.appsChainId);
  }catch(e){ return false; }
}

async function disconnectWallet(){
  if (window.ethereum && window.ethereum.request){ try{ await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); }catch(e){} }
  signer = null; myAddr = null; myHuman = null;
  try{ sessionStorage.setItem("hg_dc", "1"); }catch(e){}
  closeWalletMenu();
  renderConnectBtn();
  toast(t("m_disconnected"));
  const pe = $("profileEdit"); if (pe) pe.style.display = "none";
  if ($("campGrid")) loadCampaigns();
  if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail(); if ($("questBox")) loadQuest();
}

function renderConnectBtn(){
  document.querySelectorAll(".connectBtn").forEach(b => {
    if (!myAddr){ b.textContent = t("connect"); b.title = ""; return; }
    b.textContent = short(myAddr) + (myHuman ? " \u2713" : "");
    b.title = myHuman ? t("nav_human") : "";
  });
}
function buildWalletMenu(){
  if (walletMenu) return;
  walletMenu = document.createElement("div");
  walletMenu.className = "wallet-menu";
  walletMenu.innerHTML = '<div class="wm-addr mono" id="wmAddr"></div><button type="button" id="wmSwitch"></button><button type="button" id="wmExit"></button>';
  document.body.appendChild(walletMenu);
  $("wmSwitch").addEventListener("click", () => { closeWalletMenu(); switchAccount(); });
  $("wmExit").addEventListener("click", () => { closeWalletMenu(); disconnectWallet(); });
  document.addEventListener("click", e => { if (walletMenu && walletMenu.style.display === "block" && !walletMenu.contains(e.target) && !e.target.closest(".connectBtn")) closeWalletMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeWalletMenu(); });
}
function openWalletMenu(btn){
  buildWalletMenu();
  $("wmAddr").textContent = myAddr;
  $("wmSwitch").textContent = t("nav_switch");
  $("wmExit").textContent = t("nav_exit");
  const r = btn.getBoundingClientRect();
  walletMenu.style.top = (r.bottom + 6) + "px";
  walletMenu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
  walletMenu.style.display = "block";
}
function closeWalletMenu(){ if (walletMenu) walletMenu.style.display = "none"; }
async function switchAccount(){
  if (!window.ethereum) return;
  try{
    await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    if (accs && accs[0] && (!myAddr || accs[0].toLowerCase() !== myAddr.toLowerCase())){
      try{ sessionStorage.removeItem("hg_dc"); }catch(e){}
      myAddr = accs[0];
      try{ const prov = new ethers.BrowserProvider(window.ethereum); signer = await prov.getSigner(); }catch(e){ signer = null; }
      location.reload();
    }
  }catch(e){ toast(t("m_switch_hint")); }
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
  const title = window.__campTitles[id] || "BeCounted";
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
/* Token decimals are read once per token and cached; display formatting
   stays synchronous and falls back to 18 (BNB / BSC USD stables) until the
   cache is primed by decimalsOf() at the async load sites. */
const __decCache = new Map();
async function decimalsOf(token){
  if (!token || token === ethers.ZeroAddress) return 18;
  const k = String(token).toLowerCase();
  if (__decCache.has(k)) return __decCache.get(k);
  // Only a successful read may be cached: caching the 18 fallback after a
  // transient RPC failure would misformat every amount of a non-18-decimal
  // token for the rest of the session.
  try{ chain(); const d = Number(await new ethers.Contract(token, ERC20_ABI, providerTest).decimals()); __decCache.set(k, d); return d; }catch(e){ return 18; }
}
function fmtAmt(v, token){ // bigint amount -> short decimal, in the token's own units
  let dec = 18;
  if (token && token !== ethers.ZeroAddress){ const c = __decCache.get(String(token).toLowerCase()); if (c !== undefined) dec = c; }
  const s = ethers.formatUnits(v, dec);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

const LABELS = {};
async function voteLabels(appsRead, i){
  if (LABELS[i]) return LABELS[i];
  // A failed read is NOT cached: caching the empty fallback would degrade
  // every option label to "Option N" for the rest of the session.
  try { const ls = Array.from(await appsRead.optionLabelsOf(i)); LABELS[i] = ls; return ls; } catch(e){ return []; }
}
function optText(i, o){ const ls = LABELS[i]; return (ls && ls[o]) ? escHtml(ls[o]) : `${t("c_option")} ${o + 1}`; }
let __campSeq = 0;
async function loadCampaigns(){
  const seq = ++__campSeq; // a newer load supersedes this round; a stale round must not render over it
  const grid = $("campGrid");
  if(!grid && !$("soonGrid") && !$("statCampaigns")) return;
  chain();
  try{
    const n = Number(await appsRead.campaignCount());
    if (seq !== __campSeq) return;
    let totalEntries = 0;
    let all = [];
    if(n === 0){ if(grid) grid.innerHTML = `<div class="empty">${t("no_camp")}</div>`; }
    else{
      const order = [];
      for(let i = n-1; i >= 0; i--) order.push(i);
      const fetched = await Promise.all(order.map(i => appsRead.getCampaign(i)));
      if (grid) await Promise.all(order.map((ci, ix) => Number(fetched[ix].kind) === 1 ? voteLabels(appsRead, ci) : null));
      fetched.forEach((c, pos) => { const i = order[pos]; all.push([i, c]); window.__campTitles[i] = String(c.title); window.__campKinds[i] = Number(c.kind); window.__campTokens = window.__campTokens || {}; window.__campTokens[i] = c.prizeToken; totalEntries += Number(c.entryCount); });
      if (grid){
        let curBlock = 0; try{ curBlock = await providerTest.getBlockNumber(); }catch(e){}
        const cards = await Promise.all(order.map(async (i, pos) => {
          const c = fetched[pos];
          await decimalsOf(c.prizeToken);
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
          const hasCustom = isRaffle && !hasPrize && !!c.prizeLabel;
          if(isRaffle){
            keyline = hasPrize
              ? `<b>${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)}</b> \u00d7 ${c.winnerCount} \u00b7 ${c.entryCount} ${t("c_entries")}`
              : hasCustom
              ? `<b>${String(c.prizeLabel).replace(/</g, "&lt;")}</b> \u00b7 ${t("c_custom_tag")} \u00b7 ${c.entryCount} ${t("c_entries")}`
              : `${c.winnerCount} ${t("c_winners")} \u00b7 ${c.entryCount} ${t("c_entries")}`;
            if(c.drawn){
              let w = []; try{ w = await appsRead.getWinners(i); }catch(e){}
              extra = `<span class="count">${t("c_winner")} <b>${w.length ? short(w[0]) : "\u2014"}</b>${w.length > 1 ? ` +${w.length - 1}` : ""}</span>`;
              let iw = false, ipc = false;
              if(hasPrize && myAddr){ try{ iw = await appsRead.isWinner(i, myAddr); ipc = await appsRead.prizeClaimed(i, myAddr); }catch(e){} }
              if(hasPrize && myAddr && iw && !ipc){
                primary = `<button class="cta-btn" onclick="claimPrize(${i})">${t("c_claim_prize")}</button>`;
              } else if(hasPrize && myAddr && ipc){
                extra += `<span class="count">${t("c_prize_claimed")}</span>`;
              }
            } else if(live){
              primary = entered
                ? `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_entered")} \u2713</button>`
                : `<button class="cta-btn" onclick="enterRaffle(${i})">${t("c_enter")}</button>`;
            } else if(ended){
              primary = drawFlowHtml(i, c, curBlock, "cta-btn outline", "c_draw");
            }
          } else if(Number(c.kind) === 2){
            const claimed = Number(c.entryCount), max = Number(c.maxClaims);
            keyline = c.claimRandom
              ? `<b>${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)}</b> \u00b7 ${t("c_lucky")} \u00b7 ${claimed}/${max} ${t("c_claimed_n")}`
              : `<b>${fmtAmt(c.claimAmount, c.prizeToken)} ${tokenLabel(c.prizeToken)}</b> / ${t("c_each")} \u00b7 ${claimed}/${max} ${t("c_claimed_n")}`;
            if(live && claimed < max){
              primary = entered
                ? `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_claimed_done")} \u2713</button>`
                : `<button class="cta-btn" onclick="claimShare(${i})">${t("c_claim_btn")}</button>`;
            }
          } else {
            keyline = c.pool > 0n
              ? `<b>${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)}</b> ${t("c_vote_prize")} \u00b7 ${c.optionCount} ${t("c_options")} \u00b7 ${c.entryCount} ${t("c_entries")}`
              : `${c.optionCount} ${t("c_options")} \u00b7 ${c.entryCount} ${t("c_entries")}`;
            let opts = "";
            for(let o = 0; o < Number(c.optionCount); o++){
              let tv = 0n; try{ tv = await appsRead.tally(i, o); }catch(e){}
              opts += `<span class="opt">${optText(i, o)} \u00b7 <b>${tv}</b></span>`;
            }
            extra = `<div class="tally">${opts}</div>`;
            if(live){
              if(entered){
                let myOpt = 0;
                try{ myOpt = Number(await appsRead.voteOf(i, myAddr)); }catch(e){}
                primary = `<button class="cta-btn" disabled style="opacity:.5;cursor:default">${t("c_voted")} \u00b7 ${optText(i, myOpt)} \u2713</button>`;
              } else {
                primary = `<div class="vote-row">` + Array.from({length:Number(c.optionCount)},(_,o)=>`<button class="cta-btn outline" onclick="voteCampaign(${i},${o})">${optText(i, o)}</button>`).join("") + `</div>`;
              }
            }
          }
          if (Number(c.kind) === 1 && c.pool > 0n){
            if (c.drawn){
              if (myAddr && myWin){
                let pc = true; try{ pc = await appsRead.prizeClaimed(i, myAddr); }catch(e){}
                if (!pc) primary = `<button class="cta-btn" onclick="claimPrize(${i})">${t("c_claim_prize")}</button>`;
                else extra += `<span class="count">${t("c_prize_claimed")}</span>`;
              }
            } else if (ended){
              primary = drawFlowHtml(i, c, curBlock, "cta-btn outline", "c_draw");
            }
          }
          let postBtn = "";
          try{
            const pu = await appsRead.postUrl(i);
            if (pu && pu.startsWith("https://")) postBtn = `<a class="btn sm ghost" href="${pu.replace(/"/g, "%22")}" target="_blank" rel="noopener">${t("post_btn")}</a>`;
          }catch(e){}
          let seriesTag = "";
          try{ seriesTag = await appsRead.series(i); }catch(e){}
          let cond = null; try{ cond = await appsRead.conditionsOf(i); }catch(e){}
          if (cond) await decimalsOf(cond.gateToken);
          const creatorHtml = await creatorLabel(c.creator);
          return `<div class="camp${ended ? " is-ended" : ""}" data-kind="${Number(c.kind)}" data-status="${live ? "live" : ended ? "ended" : "upcoming"}" data-title="${String(c.title).replace(/"/g, "").toLowerCase()}" data-series="${seriesTag.replace(/"/g, "").toLowerCase()}" data-slabel="${seriesTag.replace(/"/g, "")}">
            <div class="camp-top">
              <span class="chip ${isRaffle ? "raffle" : ""}">${isRaffle ? t("c_raffle") : Number(c.kind) === 2 ? t("c_claim") : t("c_vote")}</span>
              <span class="chip ${live ? "live" : "ended"}">${live ? `<span class="livedot"></span>` : ""}${c.drawn ? t("c_drawn") : live ? t("c_live") : ended ? t("c_ended") : t("c_upcoming")}</span>${seriesTag ? `<span class="chip" style="color:var(--gold);border-color:rgba(240,185,11,.45)">${seriesTag.replace(/</g, "&lt;")}</span>` : ""}${myWin ? `<span class="chip" style="background:var(--gold);color:#000;border-color:var(--gold);font-weight:700">${t("c_you_won")}</span>` : entered ? `<span class="chip" style="color:var(--gold);border-color:rgba(240,185,11,.45)">${t(Number(c.kind) === 2 ? "c_claimed_done" : Number(c.kind) === 1 ? "c_voted" : "c_entered")}</span>` : ""}
            </div>
            <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
            <div class="keyline">${keyline}</div>${condChipsHtml(cond)}
            <div class="creator-line">${t("creator_by")} ${creatorHtml}${live || !ended ? ` \u00b7 <span class="cd" data-start="${c.startAt}" data-end="${c.endAt}"></span>` : ` \u00b7 ${fmtTime(c.endAt)}`}</div>
            <div class="cta-zone">
              ${extra}
              ${primary}
              <span class="camp-msg" role="status" id="msg-${i}"></span>
              <div class="subrow"><button class="btn sm ghost" onclick="shareCampaign(${i})">${t("share_btn")}</button>${postBtn}<a class="btn sm ghost" href="campaign.html?id=${i}" style="text-decoration:none">${t("d_details")}</a></div>
            </div>
          </div>`;
        }));
        if (seq !== __campSeq) return;
        grid.innerHTML = cards.join("");
        populateSeriesFilters();
      }
    }
    if (seq !== __campSeq) return;
    if($("statCampaigns")) $("statCampaigns").textContent = n;
    if($("statEntries")) $("statEntries").textContent = totalEntries;
    renderHot(all);
    renderSoon(all);
    tickCountdowns();
  }catch(e){
    if (seq !== __campSeq) return;
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
    <div class="hot-col"><h3>${t("hot_camps")}</h3>${byEntries.map(([i,c],r)=>`<div class="hot-row"><span class="rank">${r+1}</span><span class="hot-title">${String(c.title).replace(/</g,"&lt;")}</span><span class="hot-n">${c.entryCount} ${t("hot_entries")}</span></div>`).join("") || `<div class="hot-row">${t("no_camp")}</div>`}</div>
    <div class="hot-col"><h3>${t("hot_creators")}</h3>${topCreators.map(([addr,n],r)=>`<div class="hot-row"><span class="rank">${r+1}</span><span class="hot-title"><a href="creator.html?a=${addr}" style="color:inherit">${short(addr)}</a></span><span class="hot-n">${n} ${t("hot_entries")}</span></div>`).join("") || `<div class="hot-row">${t("no_camp")}</div>`}</div>
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
      <div class="foot"><a class="btn sm" href="campaign.html?id=${i}" style="text-decoration:none">${t("d_details")}</a></div>
    </div>`).join("") : `<div class="empty">${t("no_camp")}</div>`;
  tickCountdowns();
}
async function sendAndWait(msg, txP){
  const tx = await txP;
  if (msg) msg.textContent = t("m_waiting");
  return tx.wait();
}
function skeletonHTML(n){ return Array.from({length: n}, () => `<div class="camp skel"><div class="sk-bar w40"></div><div class="sk-bar w70"></div><div class="sk-bar w55"></div></div>`).join(""); }
/* ---------- allowlist (condition 4): Merkle root + local list ---------- */
function mkLeaf(a){ return ethers.keccak256(ethers.solidityPacked(["address"], [a])); }
function mkPair(a, b){ const x = a < b ? a : b, y = a < b ? b : a; return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y])); }
function mkLayers(list){
  let level = list.map(mkLeaf); const layers = [level];
  while (level.length > 1){ const next = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? mkPair(level[i], level[i + 1]) : level[i]); level = next; layers.push(level); }
  return layers;
}
function mkRoot(list){ if (!list || !list.length) return ethers.ZeroHash; const l = mkLayers(list); return l[l.length - 1][0]; }
function mkProof(list, target){
  const layers = mkLayers(list); let idx = list.findIndex(a => a.toLowerCase() === target.toLowerCase());
  if (idx < 0) return null;
  const proof = [];
  for (let li = 0; li < layers.length - 1; li++){ const level = layers[li]; const sib = idx % 2 === 0 ? idx + 1 : idx - 1; if (sib < level.length) proof.push(level[sib]); idx = Math.floor(idx / 2); }
  return proof;
}
/* ---------- Agent ID list (condition 5): identity-leaf Merkle ---------- */
function idLeaf(h){ return ethers.keccak256(ethers.solidityPacked(["bytes32"], [ethers.keccak256(ethers.toUtf8Bytes(h))])); }
function idLayers(list){
  let level = list.map(idLeaf); const layers = [level];
  while (level.length > 1){ const next = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? mkPair(level[i], level[i + 1]) : level[i]); level = next; layers.push(level); }
  return layers;
}
function idRootOf(list){ if (!list || !list.length) return ethers.ZeroHash; const l = idLayers(list); return l[l.length - 1][0]; }
function idProofOf(list, handle){
  const layers = idLayers(list); let idx = list.findIndex(x => x === normName(handle));
  if (idx < 0) return null;
  const proof = [];
  for (let li = 0; li < layers.length - 1; li++){ const level = layers[li]; const sib = idx % 2 === 0 ? idx + 1 : idx - 1; if (sib < level.length) proof.push(level[sib]); idx = Math.floor(idx / 2); }
  return proof;
}
function normName(x){
  let s = String(x || "").trim().toLowerCase();
  if (s.endsWith(".ai")) s = s.slice(0, -3);
  return s;
}
function validName(s){ return s.length >= 1 && s.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s); }
function parseNameList(text){
  const raw = String(text || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const out = []; const seen = new Set();
  for (const x of raw){ const s = normName(x); if (!validName(s)) return null; if (!seen.has(s)){ seen.add(s); out.push(s); } }
  return out;
}
/* List storage keys are namespaced by the apps contract address: after
   the mainnet flip the contract changes and campaign ids restart at 0,
   so a bare per-id key would feed a testnet list into a mainnet campaign
   with the same id. (The on-chain root check would still reject a wrong
   list — this keeps the prefill honest instead of merely safe.) */
const LIST_NS = String(APPS_TESTNET).toLowerCase();
function listKey(id){ return "hg_list_" + LIST_NS + "_" + id; }
function idListKey(id){ return "hg_idlist_" + LIST_NS + "_" + id; }
// One-time purge of the pre-namespace bare keys (hg_list_<id> / hg_idlist_<id>).
(function purgeLegacyListKeys(){
  try{
    const dead = [];
    for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && /^hg_(id)?list_\d+$/.test(k)) dead.push(k); }
    dead.forEach(k => localStorage.removeItem(k));
  }catch(e){}
})();
function storedIdList(id){ try{ const j = JSON.parse(localStorage.getItem(idListKey(id)) || "null"); return Array.isArray(j) ? j : null; }catch(e){ return null; } }
function storeIdList(id, list){ try{ localStorage.setItem(idListKey(id), JSON.stringify(list)); }catch(e){} }
function dlIdListJson(list, id){
  try{
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "becounted-idlist-" + id + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }catch(e){}
}
const HANDLE_ABI = ["function handleOf(address) view returns (string)"];
async function handleOfAddr(addr){
  // address -> the caller's OWN handle, read from the very registry the
  // apps contract itself consults (apps.idRegistry()). This is the only
  // direction this code ever resolves; a name is never resolved back to
  // an address anywhere in the frontend.
  try{
    chain();
    const reg = await appsRead.idRegistry();
    if (!reg || reg === ethers.ZeroAddress) return "";
    const h = await new ethers.Contract(reg, HANDLE_ABI, providerTest).handleOf(addr);
    return String(h || "").trim();
  }catch(e){ return ""; }
}
function parseAddrList(text){
  const raw = String(text || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const out = []; const seen = new Set();
  for (const a of raw){ if (!ethers.isAddress(a)) return null; const k = a.toLowerCase(); if (!seen.has(k)){ seen.add(k); out.push(ethers.getAddress(a)); } }
  return out;
}
function storedList(id){ try{ const j = JSON.parse(localStorage.getItem(listKey(id)) || "null"); return Array.isArray(j) ? j : null; }catch(e){ return null; } }
function storeList(id, list){ try{ localStorage.setItem(listKey(id), JSON.stringify(list)); }catch(e){} }
function dlListJson(list, id){
  try{
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "becounted-list-" + id + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }catch(e){}
}
window.dlAllowList = () => { const list = parseAddrList($("cdAllowList")?.value || ""); if (list && list.length) dlListJson(list, "new"); };
window.dlIdList = () => { const list = parseNameList($("cdIdList")?.value || ""); if (list && list.length) dlIdListJson(list, "new"); };
window.toggleIdList = () => { const on = !!$("cdIdOn")?.checked; if ($("cdIdRow")) $("cdIdRow").style.display = on ? "" : "none"; if ($("cdIdMeta")) $("cdIdMeta").style.display = on ? "" : "none"; if ($("cdIdHintRow")) $("cdIdHintRow").style.display = on ? "" : "none"; updIdCount(); };
window.updIdCount = () => { const el = $("cdIdCount"); if (!el) return; const list = parseNameList($("cdIdList")?.value || ""); el.textContent = list && list.length ? (list.length + " \u00b7 " + idRootOf(list).slice(0, 14) + "\u2026") : ""; };
window.toggleAllow = () => { const on = !!$("cdAllowOn")?.checked; if ($("cdAllowRow")) $("cdAllowRow").style.display = on ? "" : "none"; if ($("cdAllowMeta")) $("cdAllowMeta").style.display = on ? "" : "none"; updAllowCount(); };
window.updAllowCount = () => { const el = $("cdAllowCount"); if (!el) return; const list = parseAddrList($("cdAllowList")?.value || ""); el.textContent = list && list.length ? (list.length + " \u00b7 " + mkRoot(list).slice(0, 14) + "\u2026") : ""; };
window.toggleVPrize = () => switchCreateTab(createKind);
window.toggle721 = () => {
  const on = !!$("cdToken721")?.checked;
  if (on && $("cdTokenOn")) $("cdTokenOn").checked = true;
  const hint = $("cd721Hint"); if (hint) hint.style.display = on ? "" : "none";
  const min = $("cdTokenMin"); if (min) min.placeholder = on ? "1" : "100";
};
async function proofsFor(id, who){
  // { p4, p5 }: each is [] (condition off), a proof array, or null
  // (condition on but unprovable from here: list missing / not on the
  // list / no handle). Callers map null to m_cond_4 / m_cond_5.
  // readErr separates "the conditions read itself failed" (RPC trouble —
  // callers surface err_read) from "a condition is not met": blaming a
  // list condition for a network failure sends the user fixing the
  // wrong thing.
  const out = { p4: [], p5: [], readErr: false };
  let cd;
  try{ chain(); cd = await appsRead.conditionsOf(id); }
  catch(e){ out.readErr = true; out.p4 = null; out.p5 = null; return out; }
  try{
    if (cd.allowRoot && cd.allowRoot !== ethers.ZeroHash){
      const list = storedList(id);
      // The local list must reproduce the on-chain root; a stale or wrong
      // list fails here with a human message, not with an on-chain revert.
      out.p4 = (list && mkRoot(list).toLowerCase() === String(cd.allowRoot).toLowerCase()) ? mkProof(list, who) : null;
    }
    if (cd.idListRoot && cd.idListRoot !== ethers.ZeroHash){
      const list = storedIdList(id);
      if (!list || idRootOf(list).toLowerCase() !== String(cd.idListRoot).toLowerCase()) out.p5 = null;
      else {
        const h = await handleOfAddr(who);
        out.p5 = h ? idProofOf(list, h) : null;
      }
    }
  }catch(e){ /* proof construction failed: fail closed — callers surface m_cond_4/5 instead of sending an empty proof on-chain */ out.p4 = null; out.p5 = null; }
  return out;
}
function addrListPanelHtml(id, cd){
  if (!cd || !cd.allowRoot || cd.allowRoot === ethers.ZeroHash) return "";
  const list = storedList(id);
  let status = "";
  if (list){
    const rootOk = mkRoot(list).toLowerCase() === String(cd.allowRoot).toLowerCase();
    let mine = "";
    if (myAddr) mine = mkProof(list, myAddr) ? t("lst_in") : t("lst_out");
    status = `<div class="count" style="margin-top:6px">${rootOk ? t("lst_root_ok") : t("lst_root_bad")}${mine}</div>`;
  }
  return `<div class="panel" style="margin-top:14px"><div class="sec-head"><h2 style="font-size:17px">${t("lst_h")}</h2><p>${t("lst_hint")}</p></div><textarea id="lstText-${id}" rows="3" placeholder="${t("lst_ph")}" spellcheck="false" style="width:100%">${list ? list.join("\n") : ""}</textarea><div style="margin-top:8px"><button class="btn sm" onclick="saveList(${id})">${t("lst_save")}</button> <span class="camp-msg" role="status" id="lstMsg-${id}"></span></div>${status}</div>`;
}
function listPanelHtml(id, cd){ return addrListPanelHtml(id, cd) + idListPanelHtml(id, cd); }
function idListPanelHtml(id, cd){
  if (!cd || !cd.idListRoot || cd.idListRoot === ethers.ZeroHash) return "";
  const list = storedIdList(id);
  let status = "";
  if (list){
    const rootOk = idRootOf(list).toLowerCase() === String(cd.idListRoot).toLowerCase();
    status = `<div class="count" style="margin-top:6px">${rootOk ? t("lst_root_ok") : t("lst_root_bad")}<span id="idlstMine-${id}"></span></div>`;
  }
  return `<div class="panel" style="margin-top:14px"><div class="sec-head"><h2 style="font-size:17px">${t("idlst_h")}</h2><p>${t("idlst_hint")}</p></div><textarea id="idlstText-${id}" rows="3" placeholder="${t("idlst_ph")}" spellcheck="false" style="width:100%">${list ? list.join("\n") : ""}</textarea><div style="margin-top:8px"><button class="btn sm" onclick="saveIdList(${id})">${t("lst_save")}</button> <span class="camp-msg" role="status" id="idlstMsg-${id}"></span></div>${status}</div>`;
}
window.saveIdList = id => {
  const list = parseNameList($("idlstText-" + id)?.value || "");
  const m = $("idlstMsg-" + id);
  if (!list || !list.length){ if (m) m.textContent = t("cd_err_id"); return; }
  storeIdList(id, list);
  loadDetail();
};
async function fillIdMine(id){
  const el = $("idlstMine-" + id);
  if (!el || !myAddr) return;
  const list = storedIdList(id);
  if (!list) return;
  const h = await handleOfAddr(myAddr);
  el.textContent = !h ? t("idlst_nohandle") : (idProofOf(list, h) ? t("idlst_in") : t("idlst_out"));
}
window.saveList = id => {
  const list = parseAddrList($("lstText-" + id)?.value || "");
  const m = $("lstMsg-" + id);
  if (!list || !list.length){ if (m) m.textContent = t("cd_err_allow"); return; }
  storeList(id, list);
  loadDetail();
};
function condChipsHtml(cd){
  if (!cd) return "";
  const chips = [];
  try{
    if (cd.requireBinding) chips.push(t("chip_bind"));
    if (cd.gateToken && cd.gateToken !== ethers.ZeroAddress) chips.push(cd.gateIs721 ? `${t("chip_nft")} \u2265 ${cd.gateMin}` : `${t("chip_token")} \u2265 ${fmtAmt(cd.gateMin, cd.gateToken)}`);
    if (cd.requireEnteredId !== ethers.MaxUint256) chips.push(`${t("chip_prior")} #${cd.requireEnteredId}`);
    if (Number(cd.minStamps) > 0) chips.push(`${t("chip_stamps")} \u2265 ${cd.minStamps}`);
    if (cd.allowRoot && cd.allowRoot !== ethers.ZeroHash) chips.push(t("chip_allow"));
    if (cd.idListRoot && cd.idListRoot !== ethers.ZeroHash) chips.push(t("chip_id"));
  }catch(e){}
  return chips.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${chips.map(x => `<span class="chip" style="color:var(--gold);border-color:rgba(240,185,11,.45)">${x}</span>`).join("")}</div>` : "";
}
async function checkConditions(id, who){
  // returns failing condition index 0..5, -1 when all pass, null on read error (pre-check only; proofsFor fails closed before anything is sent)
  try{
    chain();
    const cd = await appsRead.conditionsOf(id);
    if (cd.requireBinding){ const ok = await bindingsRead.isBindingValid(who).catch(() => false); if (!ok) return 0; }
    if (cd.gateToken && cd.gateToken !== ethers.ZeroAddress){
      const bal = await new ethers.Contract(cd.gateToken, ["function balanceOf(address) view returns (uint256)"], providerTest).balanceOf(who);
      if (bal < cd.gateMin) return 1;
    }
    if (cd.requireEnteredId !== ethers.MaxUint256){ const ok = await appsRead.hasEntered(cd.requireEnteredId, who); if (!ok) return 2; }
    if (Number(cd.minStamps) > 0){ const n = await new ethers.Contract(cd.questRef, QUEST_ABI, providerTest).stampCount(who); if (Number(n) < Number(cd.minStamps)) return 3; }
    if (cd.allowRoot && cd.allowRoot !== ethers.ZeroHash){ const list = storedList(id); if (!list || mkRoot(list).toLowerCase() !== String(cd.allowRoot).toLowerCase() || !mkProof(list, who)) return 4; }
    if (cd.idListRoot && cd.idListRoot !== ethers.ZeroHash){ const list = storedIdList(id); if (!list || idRootOf(list).toLowerCase() !== String(cd.idListRoot).toLowerCase()) return 5; const h = await handleOfAddr(who); if (!h || !idProofOf(list, h)) return 5; }
    return -1;
  }catch(e){ return null; }
}
async function withSigner(fn, id, gated){
  const msg = $("msg-"+id);
  if(!signer){ toast(t("m_connect_first")); return; }
  const scope = msg ? msg.closest(".camp, #detailBox") : null;
  const btns = scope ? [...scope.querySelectorAll("button")] : [];
  btns.forEach(b => b.disabled = true);
  try{
    if (!(await ensureWalletChain())){
      if(msg) msg.textContent = t("m_wrongnet");
      toast(t("m_wrongnet"));
      return;
    }
    if (gated){
      if(msg) msg.textContent = t("m_checking");
      const h = await readGateHuman(myAddr);
      if (h === false){
        if(msg) msg.textContent = t("m_need_human");
        toast(t("m_need_human"));
        toggleGuide(true);
        const g = document.querySelector(".claimGuide");
        if (g) g.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const cf = await checkConditions(id, myAddr);
      if (cf !== null && cf >= 0){
        if(msg) msg.textContent = t("m_cond_" + cf);
        toast(t("m_cond_" + cf));
        return;
      }
    }
    if(msg) msg.textContent = t("m_signing");
    await fn(msg);
    if(msg) msg.innerHTML = t("m_done") + " " + t("share_done_hint") + ` <a href="#" onclick="shareCampaign(${id});return false;">X</a>`;
    loadCampaigns();
    if ($("detailBox")) loadDetail(); if ($("questBox")) loadQuest();
  }
  catch(e){ if(msg) msg.textContent = mappedErr(e) || (e.shortMessage || e.message || "Failed").slice(0,110); }
  finally{ btns.forEach(b => b.disabled = false); }
}
window.enterRaffle = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const pf = await proofsFor(id, myAddr); if (pf.readErr) throw new Error(t("err_read")); if (pf.p4 === null) throw new Error(t("m_cond_4")); if (pf.p5 === null) throw new Error(t("m_cond_5")); await sendAndWait(msg, a.enterRaffle(id, pf.p4, pf.p5)); }, id, true);
window.voteCampaign = (id,o) => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const pf = await proofsFor(id, myAddr); if (pf.readErr) throw new Error(t("err_read")); if (pf.p4 === null) throw new Error(t("m_cond_4")); if (pf.p5 === null) throw new Error(t("m_cond_5")); await sendAndWait(msg, a.castVote(id, o, pf.p4, pf.p5)); }, id, true);
/* V11 custom errors → human text. Without a mapping these surface as
   opaque revert data; match the decoded e.revert name (the APPS_ABI
   error fragments let ethers decode it) or the 4-byte selector in the
   revert data, whichever the wallet/RPC hands back. */
const ERR_TEXT = [
  ["ClaimExpired()", "m_err_claim_expired"],
  ["InsufficientReceived()", "m_err_insufficient"],
  ["SeedNotLocked()", "m_err_seed_notlocked"],
  ["SeedExpired()", "m_err_seed_expired"],
  ["SeedLocked()", "m_err_seed_locked"],
  ["NotHuman(address)", "ci_err_nothuman"],
  ["AlreadyCheckedIn(address,uint256)", "ci_err_already"]
];
function mappedErr(e){
  try{
    if (e && e.revert && e.revert.name){
      const hit = ERR_TEXT.find(([s]) => s.indexOf(e.revert.name + "(") === 0);
      if (hit) return t(hit[1]);
    }
    const datas = [e && e.data, e && e.error && e.error.data, e && e.info && e.info.error && e.info.error.data];
    for (const d of datas){
      if (typeof d === "string" && d.length >= 10){
        const sel = d.slice(0, 10).toLowerCase();
        const hit = ERR_TEXT.find(([s]) => ethers.id(s).slice(0, 10).toLowerCase() === sel);
        if (hit) return t(hit[1]);
      }
    }
  }catch(_){ }
  return null;
}
/* V11 two-step draw: once a campaign has ended, anyone locks the seed
   (seedBlock = lock block + 2, entries already closed so its hash is
   unknowable at lock time); the draw itself only runs while that
   block's hash sits inside the 256-block blockhash window. An aged-out
   lock is re-locked — V11 has no fallback seed. curBlock = 0 means the
   block number could not be read: fall back to the plain draw button
   (its revert is mapped to human text by mappedErr). */
function drawFlowHtml(id, c, curBlock, btnCls, drawKey){
  const cls = btnCls || "btn";
  const sb = Number(c.seedBlock);
  if (sb === 0) return `<button class="${cls}" onclick="lockDrawCampaign(${id})">${t("d_lock_seed")}</button> <span class="count">${t("d_lock_hint")}</span>`;
  if (!curBlock) return `<button class="${cls}" onclick="drawCampaign(${id})">${t(drawKey || "m_draw")}</button>`;
  if (curBlock <= sb) return `<span class="count">${t("d_seed_wait")} · ${t("d_seed_block")} #${sb} · ${t("d_cur_block")} #${curBlock}</span>`;
  if (curBlock > sb + 256) return `<button class="${cls}" onclick="lockDrawCampaign(${id})">${t("d_relock_seed")}</button> <span class="count">${t("d_seed_expired")}</span>`;
  return `<button class="${cls}" onclick="drawCampaign(${id})">${t(drawKey || "m_draw")}</button>`;
}
window.drawCampaign = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await sendAndWait(msg, a.draw(id)); }, id);
window.lockDrawCampaign = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await sendAndWait(msg, a.lockDraw(id)); }, id);
window.setPostUrlMine = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const v = ($("posturl-" + id)?.value || "").trim(); await sendAndWait(msg, a.setPostUrl(id, v)); loadMine(); }, id);
window.setSeriesMine = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const v = ($("series-" + id)?.value || "").trim(); await sendAndWait(msg, a.setSeries(id, v)); loadMine(); }, id);
window.claimShare = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); const pf = await proofsFor(id, myAddr); if (pf.readErr) throw new Error(t("err_read")); if (pf.p4 === null) throw new Error(t("m_cond_4")); if (pf.p5 === null) throw new Error(t("m_cond_5")); await sendAndWait(msg, a.claim(id, pf.p4, pf.p5)); }, id, true);
window.claimPrize = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await sendAndWait(msg, a.claimPrize(id)); }, id);
window.reclaimCampaign = id => withSigner(async (msg) => { const a = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer); await sendAndWait(msg, a.reclaim(id)); }, id);
window.onLangChange = () => { renderConnectBtn(); labelPresetOptions(); if (typeof window.__refillSampleMask === "function") window.__refillSampleMask(); if ($("campGrid")) loadCampaigns(); if ($("feedList")) loadFeed(); if ($("mineGrid")) loadMine(); if ($("questBox")) loadQuest(); if ($("detailBox")) loadDetail(); if ($("creatorBox")) loadCreator(); if ($("checkinBox")) loadCheckin(); };
function labelPresetOptions(){
  const sel = $("fTokenSel"); if (!sel) return;
  const chain = t(NETWORK.appsChainId === 56 ? "f_chain_main" : "f_chain_test");
  for (const v of ["usdt", "usdc"]){
    const opt = sel.querySelector(`option[value="${v}"]`);
    if (opt) opt.textContent = t(v === "usdt" ? "f_tok_usdt" : "f_tok_usdc").replace("{chain}", chain);
  }
}

/* ---------- live gate feed ---------- */
let __feedLoading = false;
async function loadFeed(){
  const ul = $("feedList"); if(!ul || __feedLoading) return;
  __feedLoading = true;
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    if ($("feedBlock")) $("feedBlock").textContent = t("feed_blk") + " " + latest.toLocaleString();
    const logs = await getLogsChunked({ address: APPS_TESTNET }, Math.max(0, latest - 30000), latest);
    const iface = new ethers.Interface(APPS_ABI);
    const items = [];
    for (const log of logs.slice(-40).reverse()){
      let p; try{ p = iface.parseLog(log); }catch(e){ continue; }
      if(!p) continue;
      if (p.name === "CampaignCreated") items.push(`<li><span class="ev">${t("ev_created")}</span> — <b>${String(p.args.title).replace(/</g,"&lt;")}</b></li>`);
      else if (p.name === "Entered") items.push(`<li><span class="ev">${t("ev_entered")}</span> — <b>${short(p.args.participant)}</b></li>`);
      else if (p.name === "Voted") items.push(`<li><span class="ev">${t("ev_voted")}</span> — <b>${short(p.args.participant)}</b> → ${t("c_opt")} ${Number(p.args.option)+1}</li>`);
      else if (p.name === "Drawn") items.push(`<li><span class="ev">${t("ev_drawn")}</span> — <b>#${p.args.id}</b></li>`);
      else if (p.name === "Claimed") items.push(`<li><span class="ev">${t("ev_claimed")}</span> — <b>${short(p.args.participant)}</b> · ${fmtAmt(p.args.amount, (window.__campTokens || {})[Number(p.args[0])])}</li>`);
      else if (p.name === "PrizeClaimed") items.push(`<li><span class="ev">${t("ev_prize")}</span> — <b>${short(p.args.winner)}</b> · ${fmtAmt(p.args.amount, (window.__campTokens || {})[Number(p.args[0])])}</li>`);
      if (items.length >= 6) break;
    }
    ul.innerHTML = items.length ? items.join("") : `<li>${t("feed_empty")}</li>`;
  }catch(e){ ul.innerHTML = `<li>${t("feed_fail")}</li>`; }
  finally{ __feedLoading = false; }
}

/* ---------- create campaign ---------- */
let createKind = 0; // 0 raffle, 1 vote, 2 claim
function renderOptLabels(){
  const box = $("fOptLabels"); if (!box) return;
  const n = Math.min(16, Math.max(2, parseInt($("fOptions")?.value || "2", 10) || 2));
  const prev = Array.from(box.querySelectorAll("input")).map(i => i.value);
  box.innerHTML = "";
  for (let i = 0; i < n; i++){
    const inp = document.createElement("input");
    inp.type = "text"; inp.className = "opt-label"; inp.dataset.idx = i;
    inp.placeholder = t("c_option") + " " + (i + 1);
    inp.value = prev[i] || "";
    box.appendChild(inp);
  }
}
function collectOptLabels(){ return Array.from(document.querySelectorAll("#fOptLabels input")).map(i => i.value.trim()); }
function switchCreateTab(k){
  createKind = k;
  const _tsel0 = $("fTokenSel"); if (_tsel0 && k !== 0 && _tsel0.value === "custom") _tsel0.value = "none";
  document.querySelectorAll(".form > .tabs > button").forEach((b,i)=>{ const on = i===k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  $("fWinnersRow").style.display = k===0 ? "" : "none";
  $("fOptionsRow").style.display = k===1 ? "" : "none";
  $("fOptLabelsRow").style.display = k===1 ? "" : "none";
  if (k===1) renderOptLabels();
  $("fSeedHint").style.display = k===0 ? "" : "none";
  const vp = k===1 && !!$("fVPrizeOn")?.checked;
  $("fPrizeRow").style.display = (k===0 || k===2 || vp) ? "" : "none";
  $("fTokenAddrRow").style.display = ((k!==1 || vp) && $("fTokenSel").value === "erc20") ? "" : "none";
  $("fVPrizeRow").style.display = k===1 ? "" : "none";
  $("fVTotalRow").style.display = vp ? "" : "none";
  $("fVWinnersRow").style.display = vp ? "" : "none";
  $("fPerWinnerRow").style.display = (k===0 && $("fTokenSel").value !== "none" && $("fTokenSel").value !== "custom") ? "" : "none";
  if ($("fPrizeLabelRow")) $("fPrizeLabelRow").style.display = (k===0 && $("fTokenSel").value === "custom") ? "" : "none";
  $("fPoolRow").style.display = k===2 ? "" : "none";
  $("fModeRow").style.display = k===2 ? "" : "none";
  $("fMaxClaimsRow").style.display = k===2 ? "" : "none";
  $("createSubmit").textContent = t(k===0 ? "f_submit_raffle" : k===1 ? "f_submit_vote" : "f_submit_claim");
}
function prizeTokenAddr(){
  const sel = $("fTokenSel").value;
  if (sel === "none" || sel === "custom") return null;
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
    if (sel !== "none" && sel !== "custom" && markErr("fPerWinner", !(parseFloat($("fPerWinner")?.value || "0") > 0))) errs.push(t("e_prize"));
    if (sel === "custom"){ const _lb = ($("fPrizeLabel")?.value || "").trim(); const _bl = new TextEncoder().encode(_lb).length; if (markErr("fPrizeLabel", !(_bl >= 1 && _bl <= 80))) errs.push(t("f_err_label")); }
  } else if (createKind === 1){
    const o = parseInt($("fOptions")?.value || "0", 10);
    if (markErr("fOptions", !(o >= 2 && o <= 16))) errs.push(t("e_options"));
    const _labels = collectOptLabels();
    if (_labels.length !== o || _labels.some(x => !x || new TextEncoder().encode(x).length > 60)) errs.push(t("e_opt_label"));
    if ($("fVPrizeOn")?.checked){
      const sel = $("fTokenSel")?.value || "none";
      if (sel === "none") errs.push(t("vp_err_token"));
      if (sel === "erc20" && markErr("fTokenAddr", !ethers.isAddress(($("fTokenAddr")?.value || "").trim()))) errs.push(t("e_token"));
      if (markErr("fVTotal", !(parseFloat($("fVTotal")?.value || "0") > 0))) errs.push(t("vp_err_total"));
      const w = parseInt($("fVWinners")?.value || "0", 10);
      if (markErr("fVWinners", !(w >= 1))) errs.push(t("e_winners"));
    }
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
  if (box && errs.length){ box.setAttribute("tabindex", "-1"); box.focus(); }
  return errs.length === 0;
}
function renderPreview(){
  const pv = $("createPreview"); if(!pv) return;
  const title = ($("fTitle")?.value || "").trim() || t("f_title_ph");
  let keyline = "", cta = "";
  if (createKind === 0){
    const sel = $("fTokenSel")?.value || "none";
    const w = $("fWinners")?.value || "1";
    keyline = sel === "custom"
      ? `<b>${(($("fPrizeLabel")?.value || "").trim() || t("f_prize_label")).replace(/</g, "&lt;")}</b> \u00b7 ${t("c_custom_tag")} \u00d7 ${w}`
      : sel !== "none" && parseFloat($("fPerWinner")?.value || "0") > 0
      ? `<b>${$("fPerWinner").value} ${sel === "bnb" ? "BNB" : sel.toUpperCase()}</b> \u00d7 ${w}`
      : `${w} ${t("c_winners")}`;
    cta = t("c_enter");
  } else if (createKind === 1){
    if ($("fVPrizeOn")?.checked && parseFloat($("fVTotal")?.value || "0") > 0){
      const sel = $("fTokenSel")?.value || "bnb";
      const tok = sel === "erc20" ? "ERC20" : sel.toUpperCase();
      keyline = `<b>${$("fVTotal").value} ${tok}</b> ${t("c_vote_prize")} \u00d7 ${$("fVWinners")?.value || "1"} \u00b7 ${$("fOptions")?.value || "2"} ${t("c_options")}`;
    } else keyline = `${$("fOptions")?.value || "2"} ${t("c_options")}`;
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
async function buildCond(msg){
  const cond = { requireBinding: !!$("cdBind")?.checked, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: ethers.MaxUint256, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
  if ($("cdTokenOn")?.checked){
    const a = ($("cdTokenAddr")?.value || "").trim();
    if (!ethers.isAddress(a)){ msg.textContent = t("cd_err_token"); return null; }
    const min = ($("cdTokenMin")?.value || "").trim();
    if (!min || Number(min) <= 0){ msg.textContent = t("cd_err_min"); return null; }
    cond.gateToken = a;
    cond.gateIs721 = !!$("cdToken721")?.checked;
    cond.gateMin = cond.gateIs721 ? BigInt(Math.floor(Number(min))) : await parseAmount(a, min);
  }
  if ($("cdPriorOn")?.checked){
    const v = parseInt($("cdPriorId")?.value, 10);
    if (Number.isNaN(v) || v < 0){ msg.textContent = t("cd_err_prior"); return null; }
    cond.requireEnteredId = BigInt(v);
  }
  if ($("cdStampOn")?.checked){
    const v = parseInt($("cdStampMin")?.value, 10);
    if (!v || v < 1 || v > 7){ msg.textContent = t("cd_err_stamps"); return null; }
    cond.minStamps = v;
    cond.questRef = QUEST_TESTNET;
  }
  if ($("cdAllowOn")?.checked){
    const list = parseAddrList($("cdAllowList")?.value || "");
    if (!list || list.length === 0){ msg.textContent = t("cd_err_allow"); return null; }
    cond.allowRoot = mkRoot(list);
    window.__newList = list;
  }
  if ($("cdIdOn")?.checked){
    const list = parseNameList($("cdIdList")?.value || "");
    if (!list || list.length === 0){ msg.textContent = t("cd_err_id"); return null; }
    cond.idListRoot = idRootOf(list);
    window.__newIdList = list;
  }
  return cond;
}
async function submitCreate(){
  if(!validateCreate()){ $("formMsg").textContent = ""; return; }
  const msg = $("formMsg");
  if(!signer){ toast(t("m_connect_first")); return; }
  if (!(await ensureWalletChain())){ msg.textContent = t("m_wrongnet"); toast(t("m_wrongnet")); return; }
  const title = $("fTitle").value.trim();
  const startAt = Math.floor(new Date($("fStart").value).getTime()/1000);
  const endAt = Math.floor(new Date($("fEnd").value).getTime()/1000);
  const nowS = Math.floor(Date.now()/1000);
  if(!title){ msg.textContent = t("f_err_title"); return; }
  if(!startAt || !endAt || endAt <= startAt || startAt < nowS - 120){ msg.textContent = t("f_err_time"); return; }
  const cond = await buildCond(msg);
  if (!cond) return;
  try{
    const apps = new ethers.Contract(APPS_TESTNET, APPS_ABI, signer);
    let createRcpt = null;
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
      const value = (token === ethers.ZeroAddress) ? total : 0n;
      const prizeLabel = ($("fTokenSel").value === "custom") ? ($("fPrizeLabel").value || "").trim() : "";
      createRcpt = await (await apps.createRaffle(title, startAt, endAt, winners, token, per, cond, prizeLabel, { value })).wait();
    } else if(createKind === 1){
      const options = parseInt($("fOptions").value, 10);
      if ($("fVPrizeOn")?.checked){
        let token = prizeTokenAddr();
        if (token === undefined || token === null){ msg.textContent = t("vp_err_token"); return; }
        const winners = parseInt($("fVWinners").value, 10);
        const amt = $("fVTotal").value.trim();
        if(!amt || Number(amt) <= 0 || !winners || winners < 1){ msg.textContent = t("vp_err_total"); return; }
        const total = await parseAmount(token, amt);
        await fundApprove(token, total, msg);
        msg.textContent = t("f_creating");
        chain();
        const value = (token === ethers.ZeroAddress) ? total : 0n;
        createRcpt = await (await apps.createVote(title, startAt, endAt, options, token, total, winners, cond, collectOptLabels(), { value })).wait();
      } else {
        msg.textContent = t("f_creating");
        createRcpt = await (await apps.createVote(title, startAt, endAt, options, ethers.ZeroAddress, 0n, 0, cond, collectOptLabels())).wait();
      }
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
      createRcpt = await (await apps.createClaim(title, startAt, endAt, maxClaims, token, pool, random, cond, { value })).wait();
    }
    // The new campaign's real id comes from the create receipt's
    // CampaignCreated log — guessing campaignCount()-1 breaks the moment
    // someone else creates in between (the follow-up writes would land
    // on a stranger's campaign or silently fail). The count is only a
    // last-resort fallback if the log cannot be parsed.
    let newId = null;
    try{
      const ciface = new ethers.Interface(APPS_ABI);
      for (const lg of (createRcpt && createRcpt.logs) || []){
        try{ const p = ciface.parseLog(lg); if (p && p.name === "CampaignCreated"){ newId = Number(p.args[0]); break; } }catch(e){}
      }
    }catch(e){}
    if (newId === null){ try{ newId = Number(await appsRead.campaignCount()) - 1; }catch(e){} }
    // Optional: attach the creator's X post link right away (can also be
    // added or changed later from My Campaigns). A failed second tx must
    // not fail the creation itself.
    const postUrlInput = ($("fPostUrl")?.value || "").trim();
    if (postUrlInput && newId !== null){
      try{
        await (await apps.setPostUrl(newId, postUrlInput)).wait();
      }catch(e){ /* link can be set later in My Campaigns */ }
    }
    const seriesInput = ($("fSeries")?.value || "").trim();
    if (seriesInput && newId !== null){
      try{
        await (await apps.setSeries(newId, seriesInput)).wait();
      }catch(e){ /* series can be set later in My Campaigns */ }
    }
    if (window.__newList){
      try{
        if (newId === null) throw new Error("new campaign id unknown");
        storeList(newId, window.__newList);
        dlListJson(window.__newList, newId);
      }catch(e){ /* list stays in the create form */ }
      window.__newList = null;
    }
    if (window.__newIdList){
      try{
        if (newId === null) throw new Error("new campaign id unknown");
        storeIdList(newId, window.__newIdList);
        dlIdListJson(window.__newIdList, newId);
      }catch(e){ /* list stays in the create form */ }
      window.__newIdList = null;
    }
    msg.textContent = t("f_ok");
  }catch(e){ msg.textContent = mappedErr(e) || (e.shortMessage || e.message || "Failed").slice(0,130); }
}


/* publicnode caps eth_getLogs at 50k blocks per call — chunk wider scans. */
const _logProviders = {};
function logsProvider(url){
  if (!_logProviders[url]) _logProviders[url] = new ethers.JsonRpcProvider(url, NETWORK.appsChainId, { staticNetwork: true });
  return _logProviders[url];
}
async function getLogsChunked(base, from, to){
  const out = [];
  const urls = NETWORK.appsRpcs;
  for (let s = from; s <= to; s += 45000){
    const e = Math.min(to, s + 44999);
    let logs = null, lastErr = null;
    for (let attempt = 0; attempt < 6 && !logs; attempt++){
      const p = logsProvider(urls[attempt % urls.length]);
      let timer = null;
      try{
        logs = await Promise.race([
          p.getLogs({ ...base, fromBlock: s, toBlock: e }),
          new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("logs timeout")), 20000); })
        ]);
      }catch(err){ lastErr = err; await new Promise(r => setTimeout(r, 800 * (attempt + 1))); }
      finally{ if (timer) clearTimeout(timer); }
    }
    if (!logs) throw lastErr;
    out.push(...logs);
  }
  return out;
}

/* ---------- event-log cache (watermark) ----------
   The mine / record / creator / detail pages rescan the same event
   streams from the deploy block on every visit, and the scan grows
   with the chain. getLogsCached persists each stream's logs in
   localStorage under a (contract, topics) key together with the
   highest block scanned; a later call only fetches the delta and
   merges, so aggregation sees the same log sequence as a full scan.
   Serialization keeps exactly the fields parseLog and the direct
   topic readers use. Any storage failure (quota, private mode)
   silently degrades to a plain full scan. */
const __serLog = l => ({ a: l.address, b: l.blockNumber, h: l.transactionHash, i: l.index, t: l.topics, d: l.data });
const __deLog = o => ({ address: o.a, blockNumber: o.b, transactionHash: o.h, index: o.i, topics: o.t, data: o.d });
async function getLogsCached(base, from, to){
  const key = "hg_logs_" + String(base.address || "").toLowerCase() + "_" + (base.topics ? base.topics.map(x => x == null ? "_" : String(x).toLowerCase()).join(",") : "all");
  let hit = null;
  try{
    const j = JSON.parse(localStorage.getItem(key) || "null");
    if (j && j.fromBlock === from && Number.isInteger(j.toBlock) && Array.isArray(j.logs)) hit = j;
  }catch(e){}
  if (!hit){
    const logs = await getLogsChunked(base, from, to);
    try{ localStorage.setItem(key, JSON.stringify({ fromBlock: from, toBlock: to, logs: logs.map(__serLog) })); }catch(e){}
    return logs;
  }
  if (to <= hit.toBlock) return hit.logs.filter(o => o.b <= to).map(__deLog);
  let fresh;
  try{ fresh = await getLogsChunked(base, hit.toBlock + 1, to); }
  catch(e){ return hit.logs.map(__deLog); } // delta fetch failed: serve the cached segment instead of failing the whole read
  try{ localStorage.setItem(key, JSON.stringify({ fromBlock: from, toBlock: to, logs: hit.logs.concat(fresh.map(__serLog)) })); }catch(e){}
  return hit.logs.map(__deLog).concat(fresh);
}



/* ---------- daily check-in + activity weight ----------
   The CheckIn contract keeps one record per human per day (Beijing-time
   day boundary) and derives an activity weight = 1 + check-in days in
   the trailing 30-day window. This page is a thin window on that public
   record: my status comes from the contract's views, the leaderboard is
   aggregated from the CheckedIn event log (anyone can recompute it the
   same way). The board shows truncated addresses only — never a name
   next to an address. If no code sits at CHECKIN_TESTNET on the apps
   chain (pre-deployment), the page degrades to a "coming soon" panel
   instead of throwing errors. */
let ciLive = null;   // null = not probed yet; true/false once a probe answered
let ciTimer = null;
let ciDayKey = null; // Beijing calendar day currently shown, for rollover refresh
async function ciContractLive(){
  if (ciLive !== null) return ciLive;
  if (!CHECKIN_TESTNET || CHECKIN_TESTNET === ethers.ZeroAddress){ ciLive = false; return false; }
  chain();
  try{
    const code = await providerTest.getCode(CHECKIN_TESTNET);
    ciLive = !!code && code !== "0x";
    return ciLive;
  }catch(e){ return false; } // probe failed: show "soon" this time, re-probe next load
}
function ciNextMidnightMs(){
  // Next 00:00 Beijing time (UTC+8), as a UTC epoch ms.
  const bj = Date.now() + 8 * 3600 * 1000;
  return (Math.floor(bj / 86400000) + 1) * 86400000 - 8 * 3600 * 1000;
}
function ciTick(){
  const el = $("ciCount"); if (!el) return;
  const left = ciNextMidnightMs() - Date.now();
  const s = Math.max(0, Math.floor(left / 1000));
  const p = n => String(n).padStart(2, "0");
  el.textContent = p(Math.floor(s / 3600)) + ":" + p(Math.floor(s % 3600 / 60)) + ":" + p(s % 60);
  const dayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  if (ciDayKey && dayKey !== ciDayKey && ciLive) loadCheckin(); // Beijing day rolled over: new day, new status
  ciDayKey = dayKey;
}
function ciSetStats(total, win, weight){
  if ($("ciTotal")) $("ciTotal").textContent = total === null ? "—" : total;
  if ($("ciWindow")) $("ciWindow").textContent = win === null ? "—" : win;
  if ($("ciWeight")) $("ciWeight").textContent = weight === null ? "—" : weight;
}
async function loadCheckin(){
  if (!$("checkinBox")) return;
  if ($("ciToday")) $("ciToday").textContent = new Date().toLocaleDateString(LANG === "zh" ? "zh-CN" : "en-GB", { timeZone: "Asia/Shanghai", year: "numeric", month: "short", day: "numeric" });
  ciTick();
  if (!ciTimer) ciTimer = setInterval(ciTick, 1000);
  const live = await ciContractLive();
  const soon = $("ciSoon"), main = $("ciMain");
  if (!live){
    if (soon) soon.style.display = "";
    if (main) main.style.display = "none";
    if ($("ciBoard")) $("ciBoard").innerHTML = `<div class="ci-empty">${t("ci_soon")}</div>`;
    return;
  }
  if (soon) soon.style.display = "none";
  if (main) main.style.display = "";
  refreshCiMine();
  loadCiBoard();
}
async function refreshCiMine(){
  const btn = $("ciBtn"), st = $("ciStatus");
  if (!btn || !st) return;
  if (!myAddr){
    st.textContent = t("ci_status_connect");
    ciSetStats(null, null, null);
    btn.disabled = false;
    btn.textContent = t("connect");
    return;
  }
  btn.disabled = true;
  try{
    chain();
    const [done, total, win, weight] = await Promise.all([
      checkinRead.hasCheckedInToday(myAddr),
      checkinRead.totalCheckInsOf(myAddr),
      checkinRead.windowCountOf(myAddr),
      checkinRead.weightOf(myAddr)
    ]);
    ciSetStats(Number(total), Number(win), Number(weight));
    if (done){
      st.textContent = t("ci_status_done");
      btn.disabled = true;
      btn.textContent = t("ci_btn_done");
      return;
    }
    st.textContent = t("ci_status_ready");
    btn.disabled = false;
    btn.textContent = t("ci_btn");
    // Pre-flight the gate so a non-holder gets the reason up front
    // instead of a reverted transaction.
    const human = await readGateHuman(myAddr);
    if (human === false){
      st.textContent = t("ci_not_holder");
      btn.disabled = true;
    }
  }catch(e){
    st.textContent = t("ci_board_fail");
    btn.disabled = false;
    btn.textContent = t("ci_btn");
  }
}
window.doCheckIn = async () => {
  const btn = $("ciBtn"), msg = $("ciMsg");
  try{
    if (!myAddr || !signer){
      await connectWallet();
      if (!signer){ if (msg) msg.textContent = t("m_wrongnet"); refreshCiMine(); return; }
    }
    const human = await readGateHuman(myAddr);
    if (human === false){ if (msg) msg.textContent = t("ci_not_holder"); refreshCiMine(); return; }
    btn.disabled = true;
    if (msg) msg.textContent = t("m_signing");
    const w = new ethers.Contract(CHECKIN_TESTNET, CHECKIN_ABI, signer);
    await (await w.checkIn()).wait();
    if (msg) msg.textContent = "";
    toast(t("ci_done_toast"));
    // The log cache predates this check-in; drop this stream so the
    // board re-reads the delta (same watermark key getLogsCached uses).
    try{ localStorage.removeItem("hg_logs_" + CHECKIN_TESTNET.toLowerCase() + "_" + ethers.id("CheckedIn(address,uint256,uint256)").toLowerCase()); }catch(e){}
    refreshCiMine();
    loadCiBoard();
  }catch(e){
    if (msg) msg.textContent = mappedErr(e) || (e.shortMessage || e.message || "Failed").slice(0, 130);
    btn.disabled = false;
    refreshCiMine();
  }
};
async function loadCiBoard(){
  const box = $("ciBoard"); if (!box) return;
  box.innerHTML = `<div class="ci-empty">${t("ci_board_loading")}</div>`;
  try{
    chain();
    const latest = await providerTest.getBlockNumber();
    const logs = await getLogsCached({ address: CHECKIN_TESTNET, topics: [ethers.id("CheckedIn(address,uint256,uint256)")] }, CHECKIN_DEPLOY_BLOCK, latest);
    // Each event carries the user's cumulative total, so the last event
    // per user is their lifetime count — no per-user reads needed here.
    const totals = new Map();
    const dec = ethers.AbiCoder.defaultAbiCoder();
    for (const l of logs){
      const user = ("0x" + l.topics[1].slice(26)).toLowerCase();
      totals.set(user, Number(dec.decode(["uint256", "uint256"], l.data)[1]));
    }
    const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (!rows.length){ box.innerHTML = `<div class="ci-empty">${t("ci_board_empty")}</div>`; return; }
    const weights = await Promise.all(rows.map(([a]) => checkinRead.weightOf(a).then(Number).catch(() => null)));
    box.innerHTML = rows.map(([a, total], i) =>
      `<div class="ci-row"><span class="ci-rank">${i + 1}</span><span class="ci-addr">${short(a)}</span><span class="ci-n">${total}</span><span class="ci-w">${weights[i] === null ? "—" : weights[i]}</span></div>`
    ).join("");
  }catch(e){
    box.innerHTML = `<div class="ci-empty">${t("ci_board_fail")}</div>`;
  }
}

/* ---------- filters (campaigns page) ---------- */
let liveOnly = false;
window.toggleLiveOnly = () => {
  liveOnly = !liveOnly;
  const b = $("fltLive"); if (b){ b.classList.toggle("on", liveOnly); b.setAttribute("aria-pressed", liveOnly ? "true" : "false"); }
  applyFilters();
};
function saveFilters(){
  if (!$("fltKind")) return;
  try{ sessionStorage.setItem("hg_filters", JSON.stringify({ q: $("fltQ")?.value || "", k: $("fltKind")?.value || "all", s: $("fltStatus")?.value || "all", sr: $("fltSeries")?.value || "all", live: liveOnly })); }catch(e){}
}
function restoreFilters(){
  if (!$("fltKind")) return;
  try{
    const f = JSON.parse(sessionStorage.getItem("hg_filters") || "null"); if (!f) return;
    if ($("fltQ")) $("fltQ").value = f.q || "";
    $("fltKind").value = f.k || "all";
    if ($("fltStatus")) $("fltStatus").value = f.s || "all";
    if ($("fltSeries") && f.sr && f.sr !== "all") $("fltSeries").dataset.want = f.sr;
    liveOnly = !!f.live;
    const b = $("fltLive"); if (b){ b.classList.toggle("on", liveOnly); b.setAttribute("aria-pressed", liveOnly ? "true" : "false"); }
  }catch(e){}
}
window.applyFilters = () => {
  const q = ($("fltQ")?.value || "").trim().toLowerCase();
  const k = $("fltKind")?.value || "all";
  const s = liveOnly ? "live" : ($("fltStatus")?.value || "all");
  const sr = $("fltSeries")?.value || "all";
  let total = 0, visible = 0;
  document.querySelectorAll("#campGrid .camp").forEach(el => {
    total++;
    const ok = (!q || (el.dataset.title || "").includes(q))
      && (k === "all" || el.dataset.kind === k)
      && (s === "all" || el.dataset.status === s)
      && (sr === "all" || (el.dataset.series || "") === sr);
    el.style.display = ok ? "" : "none";
    if (ok) visible++;
  });
  const fe = $("fltEmpty");
  if (fe) fe.style.display = (total > 0 && visible === 0) ? "" : "none";
  saveFilters();
};

function populateSeriesFilters(){
  const sel = $("fltSeries"); if(!sel) return;
  const seen = new Map();
  document.querySelectorAll("#campGrid .camp").forEach(el => {
    const v = el.dataset.series || "";
    if (v && !seen.has(v)) seen.set(v, el.dataset.slabel || v);
  });
  const cur = sel.dataset.want || sel.value;
  // Options are built as DOM nodes: series labels are creator-supplied
  // on-chain strings, so they must never be parsed as HTML.
  sel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all"; allOpt.textContent = t("series_all");
  sel.appendChild(allOpt);
  for (const [v, l] of seen){
    const o = document.createElement("option");
    o.value = v; o.textContent = l;
    sel.appendChild(o);
  }
  if ([...seen.keys()].includes(cur)) sel.value = cur;
  delete sel.dataset.want;
}

/* ---------- campaign detail + draw proof ---------- */
/* ---------- QuestPass expedition ---------- */
// QuestPass timestamps use the shared fmtTime() (identical format). The old fmtWhen duplicate referenced an undefined `lang` and would have crashed this page once a season reached its finale phases.
/* Short human-readable error for quest actions. withQuest referenced this
   but it was never defined, so a failed quest transaction left the UI
   stuck on its "checking" text forever. */
function friendlyErr(e){ return ((e && (e.shortMessage || e.message)) || "Failed").slice(0, 140); }
async function withQuest(fn, gated){
  const msg = $("questMsg");
  try{
    if (!signer){ await connectWallet(); if (!signer) return; }
    if (!(await ensureWalletChain())){ toast(t("m_wrongnet")); if (msg) msg.textContent = t("m_wrongnet"); return; }
    if (gated){
      if (msg) msg.textContent = t("m_checking");
      const human = await readGateHuman(myAddr).catch(() => null);
      if (human === false){ toast(t("m_need_human")); toggleGuide(true); if (msg) msg.textContent = ""; return; }
    }
    await fn(msg);
    loadQuest();
  }catch(e){ if (msg) msg.textContent = friendlyErr(e); }
}
window.questClaimStamp = () => withQuest(async msg => { const c = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, signer); await sendAndWait(msg, c.claimStamp()); }, true);
window.questEnterFinale = () => withQuest(async msg => { const c = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, signer); await sendAndWait(msg, c.enterFinale()); }, true);
window.questLockSeed = () => withQuest(async msg => { const c = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, signer); await sendAndWait(msg, c.lockFinaleSeed()); }, false);
window.questDraw = () => withQuest(async msg => { const c = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, signer); await sendAndWait(msg, c.drawFinale()); }, false);
window.questClaimPrize = () => withQuest(async msg => { const c = new ethers.Contract(QUEST_TESTNET, QUEST_ABI, signer); await sendAndWait(msg, c.claimPrize()); }, false);
window.showAllQuestEntries = () => {
  const box = $("qPartList"); if (!box) return;
  box.innerHTML = (window.__qEntries || []).map(a => `<div class="feed-item"><span class="addr">${a}</span></div>`).join("");
  const more = $("qPartMore"); if (more) more.style.display = "none";
};
async function loadQuest(){
  const box = $("questBox"); if (!box) return;
  chain();
  try{
    const [phase, day, startAt, stampEnd, entryEnd, slots, dayPool, minStamps, finalePool, ppw, tokenAddr, drawn, seedBlock, entryCount] = await Promise.all([
      questRead.phase(), questRead.currentDay(), questRead.startAt(), questRead.stampEnd(), questRead.entryEnd(),
      questRead.slotsPerDay(), questRead.dayPool(), questRead.minStamps(), questRead.finalePool(), questRead.prizePerWinner(),
      questRead.token(), questRead.finaleDrawn(), questRead.finaleSeedBlock(), questRead.finaleEntryCount()
    ]);
    await decimalsOf(tokenAddr);
    const ph = Number(phase);
    const sym = tokenLabel(tokenAddr);
    let my = null;
    if (myAddr){
      const [cnt, bm, elig, entered, winner, claimed] = await Promise.all([
        questRead.stampCount(myAddr), questRead.stampBitmap(myAddr), questRead.eligible(myAddr),
        questRead.hasEnteredFinale(myAddr), questRead.isWinner(myAddr), questRead.prizeClaimed(myAddr)
      ]);
      my = { cnt: Number(cnt), bm: Number(bm), elig, entered, winner, claimed };
    }
    const dayLeft = ph === 1 ? Number(await questRead.dayClaims(day)) : 0;
    const dots = Array.from({ length: 7 }, (_, d) => {
      const stamped = my && (my.bm >> d) & 1;
      const isToday = ph === 1 && d === Number(day);
      return `<span title="${t("q_day")} ${d + 1}" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;margin-right:6px;font-size:13px;${stamped ? "background:var(--gold);color:#111;font-weight:700" : isToday ? "border:2px solid var(--gold);color:var(--gold)" : "border:1px solid var(--line);color:var(--muted)"}">${stamped ? "\u2713" : d + 1}</span>`;
    }).join("");
    let action = "";
    if (ph === 0) action = `<span class="count">${t("q_notstarted")} \u00b7 ${fmtTime(startAt)}</span>`;
    else if (ph === 1){
      if (!myAddr) action = `<span class="count">${t("q_connect_hint")}</span><span class="count" style="display:block;width:100%;margin-top:8px">${t("q_skill_hint")} <a href="skill.html">${t("q_skill_link")}</a></span>`;
      else if ((my.bm >> Number(day)) & 1) action = `<button class="btn" disabled style="opacity:.5;cursor:default">${t("q_today_done")} \u2713</button>`;
      else if (dayLeft >= Number(slots)) action = `<button class="btn" disabled style="opacity:.5;cursor:default">${t("q_today_full")}</button>`;
      else action = `<button class="btn" onclick="questClaimStamp()">${t("q_today_claim")}</button>`;
    } else if (ph === 2){
      if (!myAddr) action = `<span class="count">${t("q_connect_hint")}</span><span class="count" style="display:block;width:100%;margin-top:8px">${t("q_skill_hint")} <a href="skill.html">${t("q_skill_link")}</a></span>`;
      else if (my.entered) action = `<button class="btn" disabled style="opacity:.5;cursor:default">${t("q_entered")} \u2713</button>`;
      else if (my.elig) action = `<button class="btn" onclick="questEnterFinale()">${t("q_enter")}</button>`;
      else action = `<span class="count">${t("q_need_more")} ${Number(minStamps) - (my ? my.cnt : 0)}</span>`;
    } else if (ph === 3){
      action = Number(seedBlock) === 0
        ? `<button class="btn" onclick="questLockSeed()">${t("q_seed_lock")}</button>`
        : `<button class="btn" onclick="questDraw()">${t("q_draw_btn")}</button>`;
    } else {
      if (myAddr && my.winner && !my.claimed) action = `<button class="btn" onclick="questClaimPrize()">${t("q_claim_prize")} ${fmtAmt(ppw, tokenAddr)} ${sym}</button>`;
      else if (myAddr && my.claimed) action = `<span class="count">${t("q_prize_claimed")}</span>`;
      else action = `<span class="count">${t("q_drawn_h")}</span>`;
    }
    let finaleHtml = "";
    if (ph >= 2){
      const entries = await questRead.getFinaleEntries();
      window.__qEntries = entries;
      const winners = ph === 4 ? await questRead.getWinners() : [];
      finaleHtml = `<div class="panel" style="margin-top:16px"><h3 style="margin-top:0">${t("q_finale_h")} \u00b7 ${fmtAmt(finalePool, tokenAddr)} ${sym}</h3>
        <div class="count">${t("q_entries_h")}: <b>${entryCount}</b>${ph === 2 ? ` \u00b7 ${t("q_phase_entry")} ${fmtTime(entryEnd)}` : ""}</div>
        ${entries.length ? `<div id="qPartList" style="margin-top:10px">${entries.slice(0, 50).map(a => `<div class="feed-item"><span class="addr">${a}</span>${winners.includes(a) ? ` <span class="tag" style="color:var(--gold)">${t("q_winner_tag")}</span>` : ""}</div>`).join("")}</div>${entries.length > 50 ? `<div id="qPartMore" style="margin-top:10px"><button class="btn sm ghost" onclick="showAllQuestEntries()">${t("d_show_all")} (${entries.length})</button></div>` : ""}` : ""}
      </div>`;
    }
    box.innerHTML = `
      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><b>${fmtAmt(dayPool, tokenAddr)} ${sym}</b><span>${t("q_stat_daypool")}</span></div>
        <div class="stat"><b>${slots}</b><span>${t("q_stat_slots")}</span></div>
        <div class="stat"><b>${fmtAmt(finalePool, tokenAddr)} ${sym}</b><span>${t("q_stat_finale")}</span></div>
        <div class="stat"><b>${minStamps} / 7</b><span>${t("q_stat_min")}</span></div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">${t("q_my_h")}${my ? ` \u00b7 ${my.cnt} / 7` : ""}</h3>
        <div style="margin:10px 0 14px">${dots}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${action}<span class="msg" id="questMsg"></span></div>
        ${ph === 1 ? `<div class="count" style="margin-top:10px">${t("q_day")} ${Number(day) + 1} \u00b7 ${t("q_today_left")} ${Math.max(0, Number(slots) - dayLeft)} / ${slots}</div>` : ""}
        ${ph === 2 && my ? `<div class="count" style="margin-top:10px">${my.elig ? t("q_eligible_yes") : t("q_need_more") + " " + (Number(minStamps) - my.cnt)}</div>` : ""}
      </div>
      ${finaleHtml}
      <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">${t("q_rules_h")}</h3>
        <ol style="margin:0;padding-left:18px;line-height:1.9"><li>${t("q_rules_1")}</li><li>${t("q_rules_2")}</li><li>${t("q_rules_3")}</li></ol>
      </div>`;
  }catch(e){ box.innerHTML = `<div class="empty">${t("v_err")}</div>`; }
}
async function loadCardQuest(addr){
  const box = $("questCardBox"); if (!box) return;
  try{
    chain();
    const [cnt, bm, elig, fin] = await Promise.all([questRead.stampCount(addr), questRead.stampBitmap(addr), questRead.eligible(addr), questRead.hasEnteredFinale(addr).catch(() => false)]);
    window.__cardQuest = { n: Number(cnt), finale: !!fin };
    const n = Number(cnt), bits = Number(bm);
    const dots = Array.from({ length: 7 }, (_, d) => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:5px;${(bits >> d) & 1 ? "background:var(--gold)" : "border:1px solid var(--line)"}"></span>`).join("");
    $("questCardBody").innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>${dots}</span><b>${n} / 7</b>${elig ? `<span class="tag" style="color:var(--gold)">${t("q_eligible_yes")}</span>` : ""}${(n >= 1 || fin) ? `<span class="tag" style="color:#000;background:var(--gold);font-weight:700">${t("q_genesis")}</span>` : ""}</div>`;
    box.style.display = "";
  }catch(e){ box.style.display = "none"; }
}

async function loadDetail(){
  const box = $("detailBox"); if(!box) return;
  const id = Number(new URLSearchParams(location.search).get("id"));
  if(!Number.isInteger(id) || id < 0){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; return; }
  chain();
  try{
    const totalCampaigns = Number(await appsRead.campaignCount());
    if (id >= totalCampaigns){ box.innerHTML = `<div class="empty">${t("d_notfound")}</div>`; return; }
    const c = await appsRead.getCampaign(id);
    await decimalsOf(c.prizeToken);
    window.__campTokens = window.__campTokens || {}; window.__campTokens[id] = c.prizeToken;
    if (Number(c.kind) === 1) await voteLabels(appsRead, id);
    let cond = null; try{ cond = await appsRead.conditionsOf(id); }catch(e){}
    if (cond) await decimalsOf(cond.gateToken);
    window.__campTitles = window.__campTitles || {}; window.__campTitles[id] = String(c.title);
    const kind = Number(c.kind);
    const nowS = Math.floor(Date.now() / 1000);
    const live = nowS >= Number(c.startAt) && nowS <= Number(c.endAt);
    const ended = nowS > Number(c.endAt);
    let curBlock = 0;
    if (ended && !c.drawn && (kind === 0 || (kind === 1 && c.pool > 0n))){ try{ curBlock = await providerTest.getBlockNumber(); }catch(e){} }
    const entries = await appsRead.getEntries(id);
    const myState = { entered: false, voted: false, option: 0, claimed: false, winner: false, prizeClaimed: false };
    if (myAddr){
      try{
        if (kind === 0){
          myState.entered = await appsRead.hasEntered(id, myAddr);
          if (c.drawn){ myState.winner = await appsRead.isWinner(id, myAddr); myState.prizeClaimed = await appsRead.prizeClaimed(id, myAddr); }
        } else {
          const latestB = await providerTest.getBlockNumber();
          const topicMe = ethers.zeroPadValue(myAddr, 32);
          const topicId = ethers.zeroPadValue(ethers.toBeHex(id), 32);
          const ifaceS = new ethers.Interface(APPS_ABI);
          if (kind === 1){
            const vl = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Voted(uint256,address,uint8)"), topicId, topicMe] }, APPS_DEPLOY_BLOCK, latestB);
            if (vl.length){ const pv = ifaceS.parseLog(vl[vl.length - 1]); if (pv){ myState.voted = true; myState.option = Number(pv.args.option); } }
          } else {
            const cl = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Claimed(uint256,address,uint256)"), topicId, topicMe] }, APPS_DEPLOY_BLOCK, latestB);
            myState.claimed = cl.length > 0;
          }
        }
        if (kind === 1 && c.pool > 0n && c.drawn){ myState.winner = await appsRead.isWinner(id, myAddr); myState.prizeClaimed = await appsRead.prizeClaimed(id, myAddr); }
      }catch(e){}
    }
    let foot = "";
    if (kind === 0){
      if (live) foot = myState.entered ? `<button class="btn" disabled style="opacity:.5;cursor:default">${t("j_entered")} \u2713</button>` : `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`;
      else if (ended && !c.drawn) foot = drawFlowHtml(id, c, curBlock, "btn", "m_draw");
      else if (c.drawn) foot = `<span class="count">${t("m_drawn")}</span>`;
      if (c.drawn && c.prizePerWinner > 0n){
        if (!myAddr || (myState.winner && !myState.prizeClaimed)) foot += ` <button class="btn ghost" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`;
        else if (myState.prizeClaimed) foot += ` <span class="count">${t("j_won_claimed")}</span>`;
      }
      if (c.drawn && c.prizePerWinner === 0n && c.prizeLabel && myState.winner) foot += ` <span class="count">${t("d_custom_claim")}</span>`;
    } else if (kind === 1){
      // Vote counts come from the contract's tally() — the same source
      // the campaigns list uses — not from a rescan of every Voted log.
      const counts = [];
      for (let o = 0; o < Number(c.optionCount); o++) counts.push(Number(await appsRead.tally(id, o)));
      const tallyBtns = counts.map((n, oi) => `<button class="opt" onclick="voteCampaign(${id}, ${oi})">${optText(id, oi)} · <b>${n}</b></button>`).join("");
      const tallyStatic = counts.map((n, oi) => `<span class="opt">${optText(id, oi)} · <b>${n}</b></span>`).join("");
      foot = (live && !myState.voted) ? `<div class="tally">${tallyBtns}</div>` : `<div class="tally">${tallyStatic}</div>` + (myState.voted ? `<div class="count" style="margin-top:8px">${t("j_voted")} \u00b7 ${optText(id, myState.option)} \u2713</div>` : "");
      if (c.pool > 0n){
        if (ended && !c.drawn) foot += " " + drawFlowHtml(id, c, curBlock, "btn", "m_draw");
        else if (c.drawn && myState.winner && !myState.prizeClaimed) foot += ` <button class="btn ghost" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`;
        else if (c.drawn && myState.prizeClaimed) foot += ` <span class="count">${t("j_won_claimed")}</span>`;
      }
    } else {
      if (live && Number(c.entryCount) < Number(c.maxClaims)) foot = myState.claimed ? `<button class="btn" disabled style="opacity:.5;cursor:default">${t("j_claimed")} \u2713</button>` : `<button class="btn" onclick="claimShare(${id})">${t("c_claim_btn")}${c.claimRandom ? "" : " " + fmtAmt(c.claimAmount, c.prizeToken) + " " + tokenLabel(c.prizeToken)}</button>`;
      else foot = `<span class="count"><b>${c.entryCount}/${c.maxClaims}</b> ${t("c_claimed_n")}</span>`;
    }
    let proof = "";
    if (kind === 0 || (kind === 1 && c.pool > 0n)){
      if (!c.drawn) proof = `<div class="sec-head" style="margin-top:34px"><h2 style="font-size:20px">${t("d_proof_h")}</h2></div><div class="empty">${t("d_notdrawn")}</div>`;
      else {
        const winners = await appsRead.getWinners(id);
        proof = `<div class="sec-head" style="margin-top:34px"><h2 style="font-size:20px">${t("d_proof_h")}</h2><p>${t("d_proof_how")}</p></div>
        <div class="panel"><div class="rows">
          <div class="row"><span>${t("d_proof_seedblock")}</span><b>${c.seedBlock}</b></div>
          <div class="row"><span>${t("d_proof_fallback")}</span><b>${c.usedFallbackSeed ? "✓" : "—"}</b></div>
        </div>
        <div style="margin-top:14px"><button class="btn sm" onclick="verifyDraw(${id})">${t("d_proof_verify")}</button> <span class="camp-msg" role="status" id="proofMsg"></span></div>
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
    // Custom-token warning: escrowed token prize whose token is neither the
    // zero address (BNB) nor one of the TOKEN_PRESETS — value/transferability
    // unverified (honeypot risk). prizeLabel campaigns escrow no token and
    // already carry their own note, so they never reach this (amounts are 0).
    const warnToken = (c.prizePerWinner > 0n || c.pool > 0n)
      && !!c.prizeToken && c.prizeToken !== ethers.ZeroAddress
      && !PRESET_TOKEN_ADDRS.has(String(c.prizeToken).toLowerCase());
    box.innerHTML = `
      <div class="kicker">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")} · #${id}</div>
      <h1 style="font-size:clamp(26px,4.4vw,40px);margin:10px 0 6px">${String(c.title).replace(/</g,"&lt;")}</h1>
      <p style="color:var(--muted)">${t("creator_by")} ${creatorHtmlD} · ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}${live || !ended ? ` · <span class="cd" data-start="${c.startAt}" data-end="${c.endAt}"></span>` : ""}</p>
      ${warnToken ? `<div class="warn-banner">⚠ ${t("warn_token")}</div>` : ""}
      <div style="margin:16px 0">${foot} <span class="camp-msg" role="status" id="msg-${id}"></span></div>
      ${postBtn ? `<div style="margin-bottom:6px">${postBtn}</div>` : ""}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" onclick="shareCampaign(${id})">${t("share_btn")}</button><button class="btn ghost" onclick="makePoster(${id})">${t("poster_btn")}</button>${kind === 0 && c.drawn ? `<button class="btn ghost" onclick="makeCert(${id})">${t("cert_btn")}</button>` : ""}</div>
      <div class="sec-head" style="margin-top:26px"><h2 style="font-size:20px">${t("d_participants")} · ${entries.length}</h2></div>
      <div class="panel"><div id="partList">${entries.length ? entries.slice(0, 50).map(a => `<div class="feed-item"><span class="addr">${a}</span></div>`).join("") : `<div class="empty">${t("rec_none")}</div>`}</div>${entries.length > 50 ? `<div id="partMore" style="margin-top:10px"><button class="btn sm ghost" onclick="showAllParticipants()">${t("d_show_all")} (${entries.length})</button></div>` : ""}${entries.length ? `<div style="margin-top:10px"><button class="btn sm ghost" onclick="exportList(${id})">${t("exp_btn")}</button></div>` : ""}</div>
      ${proof}
      ${condChipsHtml(cond)}${listPanelHtml(id, cond)}
      <div class="trust-row">${t("d_contract")} <a href="https://bscscan.com/address/${APPS_TESTNET}" target="_blank" rel="noopener">${short(APPS_TESTNET)} \u2197</a> \u00b7 BeCounted <a href="https://bscscan.com/address/${GATE_TESTNET}" target="_blank" rel="noopener">${short(GATE_TESTNET)} \u2197</a> \u00b7 ${(c.prizePerWinner > 0n || c.pool > 0n) ? t("d_escrow") : (c.prizeLabel ? t("d_custom_note") : t("d_escrow_no"))}</div>`;
    fillIdMine(id);
    window.__partEntries = entries;
    const sb = $("stickyBar");
    if (sb){
      let sAct = "", sInfo = "";
      if (kind === 0 && live && !myState.entered){ sAct = `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`; sInfo = c.prizePerWinner > 0n ? `${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)}` : (c.prizeLabel ? String(c.prizeLabel).replace(/</g, "&lt;") : String(c.title).replace(/</g, "&lt;")); }
      else if (kind === 0 && ended && !c.drawn){ sAct = drawFlowHtml(id, c, curBlock, "btn", "m_draw"); sInfo = String(c.title).replace(/</g, "&lt;"); }
      else if (kind === 0 && c.drawn && c.prizePerWinner > 0n && (!myAddr || (myState.winner && !myState.prizeClaimed))){ sAct = `<button class="btn" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`; sInfo = `${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)}`; }
      else if (kind === 1 && c.pool > 0n && c.drawn && myState.winner && !myState.prizeClaimed){ sAct = `<button class="btn" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`; sInfo = `${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)}`; }
      else if (kind === 2 && live && Number(c.entryCount) < Number(c.maxClaims) && !myState.claimed){ sAct = `<button class="btn" onclick="claimShare(${id})">${t("c_claim_btn")}</button>`; sInfo = `${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)}`; }
      if (sAct){ sb.innerHTML = `<span class="sb-info">${sInfo}</span>${sAct}`; sb.classList.add("on"); }
    }
    tickCountdowns();
  }catch(e){ box.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}
function wrapTitle(ctx, text, maxW){
  const lines = []; let cur = "";
  for (const ch of text){
    if (ctx.measureText(cur + ch).width > maxW && cur){ lines.push(cur); cur = ch; if (lines.length === 2) break; }
    else cur += ch;
  }
  if (lines.length < 2 && cur) lines.push(cur);
  return lines;
}
window.makeCert = async id => {
  const msg = $("msg-" + id);
  try{
    if (msg) msg.textContent = "\u2026";
    chain();
    const c = await appsRead.getCampaign(id);
    await decimalsOf(c.prizeToken);
    const entries = await appsRead.getEntries(id);
    const winners = await appsRead.getWinners(id);
    const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 900;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, 1600, 900);
    ctx.strokeStyle = "rgba(240,185,11,.55)"; ctx.lineWidth = 3; ctx.strokeRect(22, 22, 1556, 856);
    ctx.fillStyle = "#f0b90b"; ctx.font = "700 34px 'Space Grotesk', sans-serif";
    ctx.fillText("BeCounted", 72, 96);
    ctx.font = "500 19px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#9a9aa3";
    ctx.fillText("VERIFIED DRAW \u00b7 \u5f00\u5956\u9a8c\u8bc1", 72, 132);
    ctx.fillStyle = "#ececec"; ctx.font = "800 56px 'Space Grotesk', sans-serif";
    const lines = wrapTitle(ctx, String(c.title), 1450);
    lines.forEach((ln, i) => ctx.fillText(ln, 72, 232 + i * 68));
    const keyY = 232 + lines.length * 68 + 26;
    ctx.font = "600 30px 'Space Grotesk', sans-serif"; ctx.fillStyle = "#f0b90b";
    let key = `${t("cert_entries")}: ${entries.length}  \u00b7  ${t("cert_winners")}: ${winners.length}`;
    if (c.prizePerWinner > 0n) key += `  \u00b7  ${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)} ${t("cert_each")}`;
    else if (c.prizeLabel) key += `  \u00b7  ${String(c.prizeLabel)} (${t("c_custom_tag")})`;
    ctx.fillText(key, 72, keyY);
    ctx.font = "500 20px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#9a9aa3";
    ctx.fillText(`${t("d_proof_seedblock")}: ${c.seedBlock}${c.usedFallbackSeed ? " (fallback)" : ""}  \u00b7  ${t("cert_recompute")}`, 72, keyY + 44);
    ctx.font = "500 22px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#ececec";
    winners.slice(0, 10).forEach((w, i) => {
      const col = i < 5 ? 0 : 1, row = i % 5;
      ctx.fillText(`${i + 1}. ${w.slice(0, 10)}\u2026${w.slice(-8)}`, 72 + col * 740, keyY + 116 + row * 46);
    });
    if (winners.length > 10){ ctx.fillStyle = "#9a9aa3"; ctx.fillText(`+${winners.length - 10} \u2026`, 72, keyY + 116 + 5 * 46); }
    ctx.font = "500 18px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#6d6d75";
    ctx.fillText(SITE_URL + "  \u00b7  " + new Date().toISOString().slice(0, 10), 72, 900 - 54);
    const a = document.createElement("a");
    a.download = "becounted-draw-" + id + ".png";
    a.href = cv.toDataURL("image/png");
    a.click();
    if (msg) msg.textContent = t("cert_done");
  }catch(e){ if (msg) msg.textContent = (e.shortMessage || e.message || "Failed").slice(0, 110); }
};
window.showAllParticipants = () => {
  const box = $("partList"); if (!box) return;
  box.innerHTML = (window.__partEntries || []).map(a => `<div class="feed-item"><span class="addr">${a}</span></div>`).join("");
  const more = $("partMore"); if (more) more.style.display = "none";
};
/* One-click CSV export of the participant list. Every read mirrors the
   detail page itself: entries/winners/prizeClaimed/conditionsOf on the
   apps contract, per-person vote options and claim marks from the same
   Voted/Claimed log scans loadDetail runs for the connected wallet.
   The x_handle column exists ONLY when the campaign required a bound X
   account (conditionsOf.requireBinding): those entrants bound publicly
   precisely so anyone can check them. For any other campaign the column
   is omitted entirely — a name is never paired with an address the
   entrant did not publicly bind. Handles resolve through creatorBinding,
   the same bindingOf + isBindingValid read the identity card uses. */
window.exportList = async id => {
  const msg = $("msg-" + id);
  try{
    if (msg) msg.textContent = "\u2026";
    chain();
    const c = await appsRead.getCampaign(id);
    const kind = Number(c.kind);
    const entries = await appsRead.getEntries(id);
    let cond = null; try{ cond = await appsRead.conditionsOf(id); }catch(e){}
    const withHandle = !!(cond && cond.requireBinding);
    const winnerSet = new Set(), prizeSet = new Set();
    if (c.drawn && (kind === 0 || (kind === 1 && c.pool > 0n))){
      const winners = await appsRead.getWinners(id);
      for (const w of winners){
        const k = String(w).toLowerCase(); winnerSet.add(k);
        try{ if (await appsRead.prizeClaimed(id, w)) prizeSet.add(k); }catch(e){}
      }
    }
    const optOf = new Map(), claimSet = new Set();
    if (kind === 1 || kind === 2){
      const latestB = await providerTest.getBlockNumber();
      const topicId = ethers.zeroPadValue(ethers.toBeHex(id), 32);
      const ifaceS = new ethers.Interface(APPS_ABI);
      if (kind === 1){
        const vl = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Voted(uint256,address,uint8)"), topicId] }, APPS_DEPLOY_BLOCK, latestB);
        for (const lg of vl){ const pv = ifaceS.parseLog(lg); if (pv) optOf.set(String(pv.args.participant).toLowerCase(), Number(pv.args.option)); }
        await voteLabels(appsRead, id);
      } else {
        const cl = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Claimed(uint256,address,uint256)"), topicId] }, APPS_DEPLOY_BLOCK, latestB);
        for (const lg of cl){ const pv = ifaceS.parseLog(lg); if (pv) claimSet.add(String(pv.args.participant).toLowerCase()); }
      }
    }
    const cell = v => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = ["address", "status"];
    if (kind === 1) head.push("option");
    if (withHandle) head.push("x_handle");
    const lines = [head.join(",")];
    for (const a of entries){
      const k = String(a).toLowerCase();
      let status;
      if (kind === 0) status = winnerSet.has(k) ? (prizeSet.has(k) ? "winner_claimed" : "winner") : "entered";
      else if (kind === 1) status = winnerSet.has(k) ? (prizeSet.has(k) ? "winner_claimed" : "winner") : "voted";
      else status = claimSet.has(k) ? "claimed" : "entered";
      const row = [a, status];
      if (kind === 1){
        const oi = optOf.get(k);
        const lab = oi !== undefined && LABELS[id] ? LABELS[id][oi] : "";
        row.push(oi === undefined ? "" : (lab ? oi + ": " + lab : String(oi)));
      }
      if (withHandle){
        const cb = await creatorBinding(a);
        row.push(cb ? cb.h : "");
      }
      lines.push(row.map(cell).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "becounted-campaign-" + id + ".csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (msg) msg.textContent = "";
  }catch(e){ if (msg) msg.textContent = (e.shortMessage || e.message || "Failed").slice(0, 110); }
};
window.verifyDraw = async id => {
  const msg = $("proofMsg"); if(msg) msg.textContent = "…";
  try{
    const c = await appsRead.getCampaign(id);
    const entries = await appsRead.getEntries(id);
    const onchain = (await appsRead.getWinners(id)).map(a => a.toLowerCase());
    const latest = await providerTest.getBlockNumber();
    const logs = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Drawn(uint256,uint256,bool,uint256)"), ethers.zeroPadValue(ethers.toBeHex(id), 32)] }, APPS_DEPLOY_BLOCK, latest);
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
  return `BeCounted X binding
Handle: @${handle}
Address: ${address.toLowerCase()}
Network: BNB Chain`;
}
const __bindCache = {};
async function creatorBinding(addr){
  const k = String(addr).toLowerCase();
  if(!(k in __bindCache)){
    const p = (async () => {
      try{
        if(!bindingsRead) chain();
        const b = await bindingsRead.bindingOf(addr);
        if(!b[0]) return null;
        if(!(await bindingsRead.isBindingValid(addr))) return null;
        let pt = 0; try{ pt = Number(await bindingsRead.proofTypeOf(addr)); }catch(e){}
        return { h: b[0], pt };
      }catch(e){ return null; }
    })();
    __bindCache[k] = p;
    // A null result (RPC failure, or simply not bound yet) must not poison
    // the cache for the whole session: drop it so the next read retries.
    p.then(v => { if (v === null && __bindCache[k] === p) delete __bindCache[k]; }, () => { if (__bindCache[k] === p) delete __bindCache[k]; });
  }
  return __bindCache[k];
}
/* A binding handle is an arbitrary on-chain string: render it raw only
   when it is plain handle-shaped, otherwise HTML-escape it. Shared by
   every surface that prints a handle (creator labels, identity card). */
function shownHandle(h){ h = String(h); return /^[a-z0-9_.]+$/.test(h) ? h : escHtml(h); }
async function creatorLabel(addr){
  const cb = await creatorBinding(addr);
  if(!cb) return `<a href="creator.html?a=${addr}" style="color:inherit;text-decoration:none">${short(addr)}</a>`;
  const mark = cb.pt === 2 ? ` \u00b7 ${t("bind_self_tag")}` : " \u2713";
  const shown = shownHandle(cb.h);
  return `<a href="creator.html?a=${addr}" style="color:var(--gold);text-decoration:none">@${shown}${mark}</a>`;
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
    const tweet = `Binding my X on BeCounted: @${handle} <-> ${address}
Sig: ${sig}
#BeCountedBind`;
    const tweetUrl = "https://x.com/intent/tweet?text=" + encodeURIComponent(tweet);
    out.innerHTML = `<div class="rows">
      <div class="row"><span>${t("bind_stmt")}</span><b style="white-space:pre-wrap;text-align:right">${stmt.split("\n").join("<br>")}</b></div>
      <div class="row"><span>${t("bind_sig")}</span><b style="word-break:break-all;text-align:right;max-width:60%">${sig}</b></div></div>
      <p style="margin-top:14px;color:var(--muted)">${t("bind_tweet")}</p>
      <button class="btn sm" id="bindPostBtn">${t("bind_post")}</button>`;
    const bpb = $("bindPostBtn"); if (bpb) bpb.addEventListener("click", () => window.open(tweetUrl, "_blank"));
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">${t("tx_fail")}</span>`; }
};
window.makeSelfBind = async () => {
  const out = $("attestOut"); if(out) out.innerHTML = "…";
  try{
    const handle = ($("aHandle").value || "").trim().replace(/^@/, "").toLowerCase();
    let agent = ($("aAgent").value || "").trim().replace(/^@/, "").toLowerCase();
    if(agent && !agent.includes(".")) agent += ".ai";
    const address = ethers.getAddress(($("aAddr").value || "").trim());
    if(!handle) throw new Error("handle");
    if(!agent) throw new Error("agent");
    // Proof code: 16 hex chars of keccak(address + "@" + handle). The
    // tweet carries the two public names and this code only - never the
    // address. The holder's own agent later recomputes the code from the
    // wallet address it operates and requires an exact match before it
    // registers the binding from that wallet (registerSelf).
    const code = "BC-" + ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase() + "@" + handle)).slice(2, 18).toUpperCase();
    const tweet = `BeCounted binding verification\nHandle: @${handle}\nAgent ID: ${agent}\nProof: ${code}\n#BeCountedBind`;
    const tweetUrl = "https://x.com/intent/tweet?text=" + encodeURIComponent(tweet);
    const cmd = t("bind_self_cmd");
    out.innerHTML = `<div class="rows"><div class="row"><span>X</span><b>@${handle}</b></div>
      <div class="row"><span>Agent ID</span><b>${agent}</b></div>
      <div class="row"><span>Proof</span><b>${code}</b></div></div>
      <p style="margin-top:14px;color:var(--muted)">${t("bind_self_note")}</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn sm" id="attestPostBtn">${t("bind_self_post")}</button>
        <button class="btn sm ghost" id="selfCmdBtn">${t("bind_self_copy")}</button>
      </div>
      <p id="selfCmdText" style="margin-top:12px;color:var(--muted);font-size:13px;line-height:1.6;word-break:break-all">${cmd}</p>`;
    const apb = $("attestPostBtn"); if (apb) apb.addEventListener("click", () => window.open(tweetUrl, "_blank"));
    const scb = $("selfCmdBtn"); if (scb) scb.addEventListener("click", async () => { try{ await navigator.clipboard.writeText(cmd); scb.textContent = "✓"; setTimeout(() => { scb.textContent = t("bind_self_copy"); }, 1600); }catch(e){} });
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">${t("tx_fail")}</span>`; }
};
window.selfBindStatus = async () => {
  const out = $("attestStatusOut"); if(out) out.textContent = "…";
  try{
    const address = ethers.getAddress(($("aAddr").value || "").trim());
    chain();
    const b = await bindingsRead.bindingOf(address);
    if(!b[0]){ out.textContent = t("bind_self_none"); return; }
    const pt = Number(await bindingsRead.proofTypeOf(address));
    if(pt === 2){
      let ref = 0n; try{ ref = await bindingsRead.proofRefOf(address); }catch(e){}
      out.innerHTML = "@" + escHtml(b[0]) + " — " + t("bind_self_proof") + (ref ? ` <a href="https://x.com/i/status/${ref.toString()}" target="_blank" rel="noopener" style="color:var(--gold)">tweet</a>` : "");
    } else {
      out.textContent = "@" + b[0] + " — " + t("bind_self_sig");
    }
  }catch(e){ if(out) out.textContent = t("tx_fail"); }
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
    out.innerHTML = `<span style="color:var(--gold)">✓ ${t("bind_ok").replace("{h}", escHtml(handle))}</span><br>` +
      (bal > 0n ? `<span style="color:var(--gold)">✓ ${t("bind_ok_human")}</span>` : `<span style="color:var(--muted)">${t("bind_not_human")}</span>`) + onchain;
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">✗ ${t("bind_bad")}</span>`; }
};

/* ---------- platform stats (unique humans, payouts) ---------- */
let _statsLoading = false;
async function loadPlatformStats(){
  if(!$("statHumans") || _statsLoading) return;
  _statsLoading = true;
  chain();
  try{
    // Direct contract reads only. The previous version scanned every event
    // log since the deploy block, so the homepage got slower with every new
    // block the chain produced; this stays flat as history grows.
    const n = Number(await appsRead.campaignCount());
    const humans = new Set(); let payouts = 0;
    const per = await Promise.all(Array.from({ length: n }, async (_, i) => {
      const c = await appsRead.getCampaign(i);
      const entries = await appsRead.getEntries(i);
      let pay = 0;
      if (Number(c.kind) === 2) pay = entries.length; // claim drop: every entry was paid on entry
      else if (c.drawn) { // raffle / vote pool: count winners who actually claimed
        let winners = [];
        try { winners = await appsRead.getWinners(i); } catch(e) {}
        for (const w of winners) { try { if (await appsRead.prizeClaimed(i, w)) pay++; } catch(e) {} }
      }
      return { entries, pay };
    }));
    for (const r of per){ for (const a of r.entries) humans.add(a); payouts += r.pay; }
    $("statHumans").textContent = humans.size;
    if($("statPayouts")) $("statPayouts").textContent = payouts;
  }catch(e){
    // Never fail silently: a placeholder dash that never resolves reads
    // as "zero". Mark every stat cell still showing its placeholder as
    // unavailable instead (cells already holding real numbers keep them).
    for (const cid of ["statCampaigns", "statEntries", "statHumans", "statPayouts"]){
      const el = $(cid);
      if (el && (el.textContent.trim() === "–" || el.textContent.trim() === "")) el.textContent = t("stat_fail");
    }
  }
  _statsLoading = false;
}

/* ---------- campaign poster (16:9) ---------- */
window.makePoster = async id => {
  try{
    chain();
    const c = await appsRead.getCampaign(id);
    await decimalsOf(c.prizeToken);
    const cv = $("posterCanvas"); if(!cv) return;
    const x = cv.getContext("2d");
    const W = 1600, H = 900;
    x.fillStyle = "#0a0a0b"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#f0b90b"; x.lineWidth = 3; x.strokeRect(28, 28, W - 56, H - 56);
    x.textAlign = "left";
    x.fillStyle = "#f0b90b"; x.font = "700 34px monospace"; x.fillText("BECOUNTED", 80, 110);
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
    if (kind === 0) big = `${t("c_prize")} ${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)} \u00d7 ${c.winnerCount}`;
    else if (kind === 2) big = `${t("c_pool")} ${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)}`;
    else big = `${c.entryCount} ${t("c_entries")}`;
    x.fillText(big, 80, y0);
    x.fillStyle = "#c9c9d1"; x.font = "32px sans-serif";
    const hb = await creatorBinding(c.creator);
    x.fillText(`${t("creator_by")} ${hb ? "@" + hb.h : short(c.creator)}`, 80, y0 + 72);
    x.fillText(`${fmtTime(c.startAt)} \u2192 ${fmtTime(c.endAt)}`, 80, y0 + 124);
    let seriesTag = ""; try{ seriesTag = await appsRead.series(id); }catch(e){}
    x.fillStyle = "#8a8a93"; x.font = "26px monospace";
    x.fillText((seriesTag ? seriesTag + " \u00b7 " : "") + "Agent ID gated \u00b7 BNB Chain", 80, H - 84);
    const a = document.createElement("a");
    a.download = `becounted-campaign-${id}.png`;
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
function cardUrl(addr){ return location.origin + location.pathname + "?a=" + addr; }
function qrModules(text){
  if (typeof qrcode !== "function") return null;
  try{ const q = qrcode(0, "M"); q.addData(text); q.make(); return q; }catch(e){ return null; }
}
function drawQrTo(ctx, text, x, y, size){
  const q = qrModules(text); if (!q) return false;
  const n = q.getModuleCount();
  const cell = size / n;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - cell * 2, y - cell * 2, size + cell * 4, size + cell * 4);
  ctx.fillStyle = "#0a0a0b";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
  return true;
}
function renderCardQr(addr){
  const panel = $("cardQrPanel"); if (!panel) return;
  const cv = $("cardQr"); if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
  panel.style.display = drawQrTo(ctx, cardUrl(addr), 10, 10, 112) ? "flex" : "none";
}
function drawShareCard(){
  const cv = $("shareCanvas"); if(!cv || !lastRecord) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(240,185,11,.55)"; ctx.lineWidth = 3; ctx.strokeRect(14, 14, W-28, H-28);
  ctx.fillStyle = "#f0b90b"; ctx.font = "700 30px 'Space Grotesk', sans-serif";
  ctx.fillText("BeCounted", 56, 84);
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
  if (window.__cardQuest && window.__cardQuest.n >= 1){
    ctx.fillStyle = "#f0b90b"; ctx.font = "700 25px sans-serif";
    ctx.fillText("\u2726 GENESIS EXPEDITION \u00b7 " + window.__cardQuest.n + " / 7", 56, 416);
    ctx.fillStyle = "#e8e8e6";
  }
  ctx.font = "500 18px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#6d6d75";
  drawQrTo(ctx, cardUrl(a), W - 190, H - 170, 118);
  ctx.fillText("Agent ID · BNB Chain · " + new Date().toISOString().slice(0, 10), 56, H - 52);
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", "BeCounted · " + t("img_verified") + " · " + a + " · " + stats);
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
  creatorBinding(addr).then(hb => { if (hb) $("creatorAddr").textContent = "@" + hb.h + " \u2713 \u00b7 " + short(addr); });
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(addr, 32);
    const logs = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("CampaignCreated(uint256,address,uint8,string,uint64,uint64)"), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
    if(!logs.length){ box.innerHTML = `<div class="empty">${t("creator_none")}</div>`; return; }
    let totalEntries = 0;
    const cards = [];
    for (const log of logs.slice().reverse()){
      const id = Number(BigInt(log.topics[1]));
      const c = await appsRead.getCampaign(id);
      totalEntries += Number(c.entryCount);
      await decimalsOf(c.prizeToken);
      const kind = Number(c.kind);
      cards.push(`<div class="camp">
        <div class="camp-top"><span class="chip ${kind === 0 ? "raffle" : ""}">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")}</span></div>
        <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
        <div class="meta"><b>${t("c_window")}</b> ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}<br><b>${c.entryCount}</b> ${t("c_entries")}${kind === 0 && c.prizePerWinner > 0n ? `<br><b>${t("c_prize")}</b> ${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)}` : ""}${kind === 2 ? `<br><b>${t("c_pool")}</b> ${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)}` : ""}</div>
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
      getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Entered(uint256,address)"), null, topicAddr] }, from, latest),
      getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Voted(uint256,address,uint8)"), null, topicAddr] }, from, latest),
      getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("Claimed(uint256,address,uint256)"), null, topicAddr] }, from, latest),
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
  creatorBinding(myAddr).then(h => { if (h && nm) nm.textContent = "@" + h.h; }).catch(() => {});
  readHuman(myAddr).then(h => { const hb = $("mineHuman"); if (hb) hb.style.display = h ? "" : "none"; }).catch(() => {});
  const setN = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  setN("msCreated", createdCount);
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(myAddr, 32);
    const scan = (sig) => getLogsCached({ address: APPS_TESTNET, topics: [ethers.id(sig), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
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
async function loadJoined(){
  const grid = $("joinedGrid"); if (!grid) return;
  if (!myAddr){ grid.innerHTML = `<div class="empty">${t("j_connect")}</div>`; return; }
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(myAddr, 32);
    const iface = new ethers.Interface(APPS_ABI);
    const mineMap = new Map();
    const scans = [
      ["Entered(uint256,address)", p => ({ entered: true })],
      ["Voted(uint256,address,uint8)", p => ({ voted: true, option: Number(p.args.option) })],
      ["Claimed(uint256,address,uint256)", p => ({ claimed: true, amount: p.args.amount })]
    ];
    for (const [sig, mk] of scans){
      const logs = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id(sig), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
      for (const l of logs){
        const parsed = iface.parseLog(l); if (!parsed) continue;
        const id = Number(parsed.args[0]);
        mineMap.set(id, { ...(mineMap.get(id) || {}), ...mk(parsed) });
      }
    }
    if (!mineMap.size){ grid.innerHTML = `<div class="empty">${t("j_none")}</div>`; return; }
    const ids = [...mineMap.keys()].sort((a, b) => b - a);
    const cards = [];
    for (const id of ids){
      const c = await appsRead.getCampaign(id);
      await decimalsOf(c.prizeToken);
      if (String(c.creator).toLowerCase() === myAddr.toLowerCase()) continue;
      const kind = Number(c.kind);
      const now = Math.floor(Date.now() / 1000);
      const live = now >= Number(c.startAt) && now <= Number(c.endAt);
      const ended = now > Number(c.endAt);
      const st = mineMap.get(id);
      let status = "";
      if (kind === 0){
        if (!c.drawn) status = t("j_entered");
        else if (await appsRead.isWinner(id, myAddr)) status = (await appsRead.prizeClaimed(id, myAddr)) ? t("j_won_claimed") : `<b style="color:var(--gold)">${t("j_winner")}</b>`;
        else status = t("j_notwon");
      } else if (kind === 1){
        const ls = await voteLabels(appsRead, id);
        status = `${t("j_voted")} \u00b7 ${ls[st.option ?? 0] ? escHtml(ls[st.option ?? 0]) : t("c_option") + " " + ((st.option ?? 0) + 1)}`;
      } else {
        status = st.claimed ? `${t("j_claimed")} \u00b7 ${fmtAmt(st.amount, c.prizeToken)} ${tokenLabel(c.prizeToken)}` : t("j_entered");
      }
      cards.push(`<div class="camp">
        <div class="camp-top"><span class="chip ${kind === 0 ? "raffle" : ""}">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")}</span><span class="count">${live ? t("c_live") : ended ? t("c_ended") : t("c_upcoming")}</span></div>
        <h3>${String(c.title).replace(/</g, "&lt;")}</h3>
        <div class="meta"><b>${t("j_mystatus")}</b> ${status}<br><b>${t("c_window")}</b> ${fmtTime(c.startAt)} \u2192 ${fmtTime(c.endAt)}</div>
        <div class="foot"><a class="btn sm" href="campaign.html?id=${id}" style="text-decoration:none">${t("d_details")}</a></div>
      </div>`);
    }
    grid.innerHTML = cards.length ? cards.join("") : `<div class="empty">${t("j_none")}</div>`;
  }catch(e){ grid.innerHTML = `<div class="empty">${t("load_fail")}</div>`; }
}
async function loadMine(){
  loadJoined();
  const grid = $("mineGrid"); if(!grid) return;
  if(!myAddr){ grid.innerHTML = `<div class="empty">${t("mine_connect")}</div>`; return; }
  chain();
  try{
    const latest = await providerTest.getBlockNumber();
    const topicAddr = ethers.zeroPadValue(myAddr, 32);
    const logs = await getLogsCached({ address: APPS_TESTNET, topics: [ethers.id("CampaignCreated(uint256,address,uint8,string,uint64,uint64)"), null, topicAddr] }, APPS_DEPLOY_BLOCK, latest);
    renderMineSummary(logs.length);
    if(!logs.length){ grid.innerHTML = `<div class="empty">${t("mine_none")}</div>`; return; }
    const cards = [];
    for (const log of logs.slice().reverse()){
      const id = Number(BigInt(log.topics[1]));
      const c = await appsRead.getCampaign(id);
      const now = Math.floor(Date.now()/1000);
      const ended = now > Number(c.endAt);
      const kind = Number(c.kind);
      await decimalsOf(c.prizeToken);
      let actions = "";
      if (kind === 0 && ended && !c.drawn) actions += drawFlowHtml(id, c, latest, "btn sm", "c_draw");
      if (kind === 0 && c.drawn) actions += `<button class="btn sm ghost" onclick="copyWinners(${id}, this)">${t("m_copy")}</button>`;
      if ((kind === 2 && ended && !c.reclaimed) || (kind === 0 && c.drawn && !c.reclaimed && now > Number(c.endAt) + 2592000)) actions += `<button class="btn sm ghost" onclick="reclaimCampaign(${id})">${t("m_reclaim")}</button>`;
      const curPost = await appsRead.postUrl(id).catch(() => "");
      const curSeries = await appsRead.series(id).catch(() => "");
      cards.push(`<div class="camp">
        <div class="camp-top"><span class="chip ${kind === 0 ? "raffle" : ""}">${kind === 0 ? t("c_raffle") : kind === 2 ? t("c_claim") : t("c_vote")}</span><span class="chip ${ended ? "ended" : "live"}">${ended ? t("c_ended") : t("c_live")}</span></div>
        <h3>${String(c.title).replace(/</g,"&lt;")}</h3>
        <div class="meta"><b>${t("c_window")}</b> ${fmtTime(c.startAt)} → ${fmtTime(c.endAt)}<br><b>${t("c_entries")}</b> ${c.entryCount}${kind === 0 && c.prizePerWinner > 0n ? `<br><b>${t("c_prize")}</b> ${fmtAmt(c.prizePerWinner, c.prizeToken)} ${tokenLabel(c.prizeToken)} · ${t("paid_out")} ${fmtAmt(c.paidOut, c.prizeToken)}` : ""}${kind === 2 ? `<br><b>${t("c_pool")}</b> ${fmtAmt(c.pool, c.prizeToken)} ${tokenLabel(c.prizeToken)} · ${t("paid_out")} ${fmtAmt(c.paidOut, c.prizeToken)}` : ""}</div>
        <div class="foot" style="gap:8px;flex-wrap:wrap">${actions}<span class="camp-msg" role="status" id="msg-${id}"></span></div>
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
  document.querySelectorAll(".connectBtn").forEach(b => b.addEventListener("click", () => { if (myAddr && signer) { if (walletMenu && walletMenu.style.display === "block") closeWalletMenu(); else openWalletMenu(b); } else connectWallet(); }));
  const rbb = $("registerBindBtn");
  if (rbb) rbb.onclick = async () => {
    if(!lastBind){ toast(t("bind_need_sig")); return; }
    rbb.disabled = true;
    try{
      await connectWallet();
      const bw = new ethers.Contract(BINDINGS_TESTNET, BINDINGS_ABI, signer);
      await (await bw.registerBinding(lastBind.handle, lastBind.sig)).wait();
      __bindCache[signer.address.toLowerCase()] = Promise.resolve({ h: lastBind.handle, pt: 0 });
      if ($("bindRegStatus")) $("bindRegStatus").textContent = t("bind_registered");
      toast(t("bind_registered"));
    }catch(e){ if ($("bindRegStatus")) $("bindRegStatus").textContent = (e.shortMessage || e.message || "").slice(0, 140); }
    rbb.disabled = false;
  };
  if ($("cardAvatar")) drawIdenticon("0x0000000000000000000000000000000000000000");
  const ldd = $("learnDd");
  if (ldd){
    const lbtn = $("learnBtn");
    if (ldd.querySelector(".nav-dd-menu a.on")) lbtn.classList.add("on");
    lbtn.setAttribute("aria-haspopup", "true");
    lbtn.setAttribute("aria-expanded", "false");
    lbtn.addEventListener("click", e => { e.stopPropagation(); ldd.classList.toggle("open"); lbtn.setAttribute("aria-expanded", ldd.classList.contains("open") ? "true" : "false"); });
    document.addEventListener("click", e => { if(!ldd.contains(e.target)){ ldd.classList.remove("open"); lbtn.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", e => { if(e.key === "Escape"){ ldd.classList.remove("open"); lbtn.setAttribute("aria-expanded", "false"); } });
  }
  (async () => {
    try{
      if(!window.ethereum) return;
      try{ if (sessionStorage.getItem("hg_dc")) return; }catch(e){}
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if(!accs || !accs[0]) return;
      myAddr = accs[0];
      // Restore the signer too, not just the address: without it the UI
      // looks connected while every action bounces off "connect first".
      try{
        const prov = new ethers.BrowserProvider(window.ethereum);
        const sg = await prov.getSigner();
        if ((await sg.getAddress()).toLowerCase() === myAddr.toLowerCase()) signer = sg;
      }catch(e){ signer = null; }
      // The wallet account may have changed while the awaits above were
      // in flight; accountsChanged ignores events until myAddr is set,
      // so re-read once — on a mismatch, take the same reload path the
      // accountsChanged handler uses for a switched account.
      try{
        const again = await window.ethereum.request({ method: "eth_accounts" });
        if (again && again[0] && again[0].toLowerCase() !== myAddr.toLowerCase()){ try{ sessionStorage.removeItem("hg_dc"); }catch(e){} myAddr = again[0]; location.reload(); return; }
      }catch(e){}
      renderConnectBtn();
      readHuman(myAddr).then(h => { myHuman = h; renderConnectBtn(); }).catch(() => {});
      if ($("campGrid") || $("soonGrid")) loadCampaigns();
      if ($("detailBox")) loadDetail(); if ($("questBox")) loadQuest();
      if ($("checkinBox")) loadCheckin();
      if ($("cardBtn") && !new URLSearchParams(location.search).get("a")) { $("cardInput").value = myAddr; $("cardBtn").click(); }
    }catch(e){}
  })();
  if (window.ethereum && window.ethereum.on) window.ethereum.on("accountsChanged", accs => { if (!accs || !accs[0]){ if (myAddr) disconnectWallet(); return; } if (myAddr && accs[0].toLowerCase() !== myAddr.toLowerCase()){ try{ sessionStorage.removeItem("hg_dc"); }catch(e){} myAddr = accs[0]; location.reload(); } });
  if (window.ethereum && window.ethereum.on) window.ethereum.on("chainChanged", () => location.reload());
  let sampleArmed = false;
  const cb = $("checkBtn");
  if (cb) cb.onclick = () => { if (sampleArmed) { checkAddress(SAMPLE_HOLDER, $("verdict")); } else { checkAddress($("checkInput").value.trim(), $("verdict")); } };
  const ci = $("checkInput");
  if (ci) { ci.addEventListener("keydown", e => { if(e.key === "Enter") cb.click(); }); ci.addEventListener("input", () => { sampleArmed = false; }); }
  const ts = $("trySample");
  if (ts) ts.onclick = () => { sampleArmed = true; $("checkInput").value = t("check_sample_mask"); checkAddress(SAMPLE_HOLDER, $("verdict")); };
  window.__refillSampleMask = () => { if (sampleArmed && $("checkInput")) $("checkInput").value = t("check_sample_mask"); };
  const db = $("demoBots"); if (db) db.onclick = () => window.demoBots();
  const dh = $("demoHuman"); if (dh) dh.onclick = () => window.demoHuman();
  const dr = $("demoReset"); if (dr) dr.onclick = () => window.demoReset();

/* ---------- anti-sybil live demo (no wallet; live mainnet registry reads) ---------- */
const demoState = { tried: 0, passed: 0, rejected: 0, running: false, humanIn: false };
function demoCounts(){
  if ($("demoTried")) $("demoTried").textContent = demoState.tried;
  if ($("demoPassed")) $("demoPassed").textContent = demoState.passed;
  if ($("demoRejected")) $("demoRejected").textContent = demoState.rejected;
}
function demoRow(addr, tag, label){
  const li = document.createElement("li");
  li.className = "demo-row";
  const shown = label || (addr.slice(0, 10) + "\u2026" + addr.slice(-6));
  li.innerHTML = `<span class="demo-addr">${shown}</span><span class="demo-tag">${tag}</span><span class="demo-state">${t("demo_checking")}</span>`;
  return li;
}
function demoSetRow(li, ok, text){
  li.classList.add(ok ? "ok" : "no");
  li.querySelector(".demo-state").textContent = text;
}
async function mainnetBatchBalance(addrs){
  // dataseed rejects oversized JSON-RPC batches — read in slices of 20,
  // rotating endpoints per slice.
  const data = a => "0x70a08231" + "000000000000000000000000" + a.slice(2).toLowerCase();
  const out = new Array(addrs.length);
  for (let s = 0; s < addrs.length; s += 20){
    const slice = addrs.slice(s, s + 20);
    const payload = slice.map((a, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: REGISTRY_MAINNET, data: data(a) }, "latest"] }));
    let done = false;
    for (let u = 0; u < NETWORK.mainRpcs.length && !done; u++){
      try{
        const r = await fetch(NETWORK.mainRpcs[(s / 20 + u) % NETWORK.mainRpcs.length], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (!Array.isArray(j)) continue;
        const part = new Array(slice.length);
        for (const item of j){ if (item && typeof item.id === "number" && item.result) part[item.id] = BigInt(item.result); }
        if (part.every(v => v !== undefined)){ part.forEach((v, i) => { out[s + i] = v; }); done = true; }
      }catch(e){}
    }
    if (!done) throw new Error("registry batch read failed");
  }
  return out;
}
window.demoBots = async () => {
  if (demoState.running) return;
  const list = $("demoList"); if (!list) return;
  demoState.running = true;
  $("demoBots").disabled = true; $("demoHuman").disabled = true;
  const empty = list.querySelector(".demo-empty"); if (empty) empty.remove();
  const addrs = [], rows = [];
  for (let i = 0; i < 100; i++){
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    addrs.push("0x" + [...b].map(x => x.toString(16).padStart(2, "0")).join(""));
  }
  for (let i = 0; i < 100; i += 10){
    for (let k = i; k < Math.min(i + 10, 100); k++){ const li = demoRow(addrs[k], t("demo_bot_tag")); list.prepend(li); rows.push(li); demoState.tried++; }
    demoCounts();
    await new Promise(r => setTimeout(r, 70));
  }
  try{
    const bals = await mainnetBatchBalance(addrs);
    for (let i = 0; i < 100; i++){
      if (bals[i] > 0n){ demoSetRow(rows[i], true, t("demo_passed")); demoState.passed++; }
      else { demoSetRow(rows[i], false, t("demo_rejected")); demoState.rejected++; }
      if (i % 5 === 0){ demoCounts(); await new Promise(r => setTimeout(r, 30)); }
    }
    demoCounts();
    $("demoCap").textContent = t("demo_cap_bots");
  }catch(e){
    rows.forEach(li => demoSetRow(li, false, t("demo_err")));
    $("demoCap").textContent = t("demo_err");
  }
  demoState.running = false;
  $("demoBots").disabled = false; $("demoHuman").disabled = demoState.humanIn;
};
window.demoHuman = async () => {
  if (demoState.running || demoState.humanIn) return;
  const list = $("demoList"); if (!list) return;
  demoState.running = true;
  $("demoBots").disabled = true; $("demoHuman").disabled = true;
  const empty = list.querySelector(".demo-empty"); if (empty) empty.remove();
  const li = demoRow(SAMPLE_HOLDER, t("demo_human_tag"), "9nosing.ai");
  list.prepend(li);
  demoState.tried++; demoCounts();
  try{
    chain();
    const bal = await registry.balanceOf(SAMPLE_HOLDER);
    if (bal > 0n){ demoSetRow(li, true, t("demo_passed")); demoState.passed++; demoState.humanIn = true; $("demoCap").textContent = t("demo_cap_human"); }
    else { demoSetRow(li, false, t("demo_rejected")); demoState.rejected++; }
  }catch(e){ demoSetRow(li, false, t("demo_err")); }
  demoCounts();
  demoState.running = false;
  $("demoBots").disabled = false; $("demoHuman").disabled = demoState.humanIn;
};
window.demoReset = () => {
  if (demoState.running) return;
  const list = $("demoList"); if (!list) return;
  demoState.tried = 0; demoState.passed = 0; demoState.rejected = 0; demoState.humanIn = false;
  list.innerHTML = `<li class="demo-empty" data-i18n="demo_empty">${t("demo_empty")}</li>`;
  $("demoCap").textContent = t("demo_cap0");
  $("demoHuman").disabled = false;
  demoCounts();
};
  const kb = $("cardBtn");
  if (kb) kb.onclick = async () => {
    const addr = $("cardInput").value.trim();
    if(!ethers.isAddress(addr)){ toast(t("card_invalid")); return; }
    $("cardAddr").textContent = addr;
    renderCardQr(addr);
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
    loadProfile(addr);
    loadCardQuest(addr);
    const hbEl = $("cardBinding");
    if (hbEl){ hbEl.innerHTML = ""; creatorBinding(addr).then(hb => { const be = $("bindEntryStatus"); if (be) be.textContent = hb ? "@" + hb.h + " \u2713" : t("card_bind_none"); if (hb) { const nm = $("cardName"); if (nm) nm.textContent = "@" + hb.h; hbEl.innerHTML = `<a href="https://x.com/${encodeURIComponent(hb.h)}" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;font-family:var(--mono);font-size:15px">@${shownHandle(hb.h)}</a> <span class="pill">${t("bind_bound")}</span>`; } }); }
  };
  const kbAuto = new URLSearchParams(location.search).get("a");
  if (kb && kbAuto && ethers.isAddress(kbAuto)) { $("cardInput").value = kbAuto; kb.click(); }
  const pfl = $("pfLinks");
  if (pfl){
    let h = "";
    for (let i = 0; i < 5; i++) h += `<div class="f-2col"><div class="f-row"><input id="pfT${i}" data-i18n-ph="prof_title_ph" spellcheck="false"></div><div class="f-row"><input id="pfU${i}" data-i18n-ph="prof_url_ph" spellcheck="false"></div></div>`;
    pfl.innerHTML = h;
    applyI18n();
    $("pfSave").addEventListener("click", saveProfile);
    $("pfRemove").addEventListener("click", removeProfileFn);
  }
  const clb = $("copyLinkBtn");
  if (clb) clb.onclick = async () => {
    const a2 = ($("cardAddr")?.textContent || "").trim();
    if (!ethers.isAddress(a2)) return;
    try{ await navigator.clipboard.writeText(location.origin + location.pathname + "?a=" + a2); toast(t("m_copied")); }catch(e){}
  };
  if ($("campGrid")){ $("campGrid").innerHTML = skeletonHTML(6); restoreFilters(); }
  const fltClr = $("fltClear");
  if (fltClr) fltClr.addEventListener("click", () => {
    if ($("fltQ")) $("fltQ").value = "";
    if ($("fltKind")) $("fltKind").value = "all";
    if ($("fltStatus")) $("fltStatus").value = "all";
    if ($("fltSeries")) $("fltSeries").value = "all";
    if (liveOnly) window.toggleLiveOnly(); else applyFilters();
  });
  if ($("soonGrid")) $("soonGrid").innerHTML = skeletonHTML(3);
  if ($("mineGrid")) $("mineGrid").innerHTML = skeletonHTML(3);
  if ($("joinedGrid")) $("joinedGrid").innerHTML = skeletonHTML(3);
  if ($("detailBox")) $("detailBox").innerHTML = skeletonHTML(1);
  if ($("campGrid") || $("statCampaigns")) loadCampaigns();
  if ($("mineGrid")) loadMine();
  if ($("statHumans")) loadPlatformStats();
  if ($("creatorBox")) loadCreator();
  if ($("detailBox")) loadDetail(); if ($("questBox")) loadQuest();
  if ($("checkinBox")) loadCheckin();
  const cib = $("ciBtn");
  if (cib) cib.addEventListener("click", () => window.doCheckIn());
  const scb = $("makeCardBtn");
  if (scb) scb.addEventListener("click", drawShareCard);
  if ($("feedList")){ loadFeed(); setInterval(loadFeed, 25000); }
  if ($("createSubmit")){
    // Default window: starts in 5 minutes, ends in 3 days.
    const toLocal = d => { const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    $("fStart").value = toLocal(new Date(Date.now() + 5*60000));
    $("fEnd").value = toLocal(new Date(Date.now() + 3*86400000));
    document.querySelectorAll(".form > .tabs > button").forEach((b,i)=> b.addEventListener("click", ()=>switchCreateTab(i)));
    $("fOptions")?.addEventListener("input", renderOptLabels);
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
      $("fPerWinnerRow").style.display = (tsel.value !== "none" && tsel.value !== "custom" && createKind === 0) ? "" : "none";
      if ($("fPrizeLabelRow")) $("fPrizeLabelRow").style.display = (tsel.value === "custom" && createKind === 0) ? "" : "none";
      renderPreview();
    });
    labelPresetOptions();
    switchCreateTab(0);
  }
});
