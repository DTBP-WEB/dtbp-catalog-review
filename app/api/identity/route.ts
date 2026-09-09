import { getChatGPTUser } from '../../chatgpt-auth';
import { json } from '../../../lib/review-server';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();return user?json({userId:user.userId,email:user.email}):json({error:'Sign in required.'},401);}
