import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return <main className="entry"><div className="brand">DTBP</div><p className="eyebrow">CATALOG REVIEW</p><h1>Your items to check.</h1><p>Review the issue, confirm the right title, SKU and brand, then choose OK or tell us what needs fixing.</p><a className="primary" href={user ? '/review' : chatGPTSignInPath('/review')} target="_top">{user ? 'Open my review queue' : 'Sign in with ChatGPT'}</a><p className="quiet">Your choices save online. Nothing publishes to the website or changes inFlow from here.</p>{user && <a href={chatGPTSignOutPath('/')}>Sign out</a>}<footer>Owner access only. Use the same ChatGPT account that created this review.</footer></main>;
}
