import {requireChatGPTUser} from '../chatgpt-auth';
import CloudProof from './proof';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/cloud-proof');return <CloudProof/>;}
