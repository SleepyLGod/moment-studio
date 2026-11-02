import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {handleApi,type GalleryEnv} from '../../../server/api';

export const dynamic='force-dynamic';
async function handler(request:Request){return handleApi(request,env as GalleryEnv,await getChatGPTUser());}
export {handler as GET,handler as HEAD,handler as POST,handler as PUT};
