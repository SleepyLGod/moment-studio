import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../chatgpt-auth';
import {handleMcp} from '../../server/mcp';
import type {GalleryEnv} from '../../server/api';
export const dynamic='force-dynamic';
export async function POST(request:Request){return handleMcp(request,env as GalleryEnv,await getChatGPTUser());}
