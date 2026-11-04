import React, {useEffect, useState} from 'react';
import {Button, Modal} from './components';
import {canPurge,deleteReviewedPhotos,reviewDeletion} from './services/deletion';

const gridKey = 'moment.grid-size';
const sizes = ['small','medium','large'];

export function readGridSize() {
  try {
    const size = localStorage.getItem(gridKey);
    return sizes.includes(size) ? size : 'medium';
  } catch {
    return 'medium';
  }
}

export function writeGridSize(size) {
  try { localStorage.setItem(gridKey,size); }
  catch { /* The preference still applies for this visit. */ }
}

export function SettingsDialog({size,onSize,client,onClose}) {
  const [connection,setConnection] = useState(null);
  const [problem,setProblem] = useState(false);
  useEffect(()=>{
    if (!client) return;
    let current = true;
    client.settings().then(data=>{
      if (current) setConnection(data.connection);
    }).catch(()=>{
      if (current) setProblem(true);
    });
    return ()=>{current=false;};
  },[client]);
  let status = 'Local preview';
  if (client) {
    if (problem) status = 'Could not check connection';
    else if (!connection) status = 'Checking…';
    else status = connection.ready ? 'Connected' : 'Disconnected';
  }
  const expiry = connection?.ready && connection.expiresAt
    ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(connection.expiresAt)
    : null;

  return <Modal title="Settings" onClose={onClose}>
    <label className="field settings-row">Thumbnail size
      <select value={size} onChange={event=>onSize(event.target.value)}>
        <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
      </select>
    </label>
    <p className="muted small">Applies to the library grid in this browser.</p>
    <div className="settings-row settings-connection">
      <span>OpenAI cloud</span>
      <span role="status">{status}{expiry&&<small>Expires {expiry}</small>}</span>
    </div>
    <footer className="modal-footer"><Button onClick={onClose}>Done</Button></footer>
  </Modal>;
}

const linkLabel = {album:'Album',generation:'Generated image',collage:'Collage',photo:'Photo'};

function DeleteReviewRow({review}) {
  const {photo,impact,problem} = review;
  const blocked = impact && !impact.pending && impact.links?.length > 0;
  return <li className="purge-review-row">
    <strong>{photo.name}</strong>
    {problem&&<p className="purge-problem">{problem}</p>}
    {impact?.deleted&&<p className="muted small">Already deleted</p>}
    {blocked&&<>
      <p className="muted small">In use by</p>
      <ul className="purge-links">{impact.links.map(link=><li key={link.kind+'-'+link.id}>
        <span>{link.name||'Untitled'}</span>
        <small>{linkLabel[link.kind]||'Photo'}{link.trashed?' · In Trash':''}</small>
      </li>)}</ul>
      {impact.moreLinks&&<p className="muted small">More linked items are present.</p>}
    </>}
    {impact&&!blocked&&!impact.deleted&&<p className="muted small">
      {impact.pending?'Deletion started · ':''}{impact.filesToDelete} file{impact.filesToDelete===1?'':'s'} to remove
      {impact.filesToKeep>0?' · '+impact.filesToKeep+' shared kept':''}
    </p>}
  </li>;
}

export function DeletePhotosDialog({photos,client,onClose,onDeleted}) {
  const [reviews,setReviews] = useState(null);
  const [result,setResult] = useState(null);
  const [saving,setSaving] = useState(false);

  useEffect(()=>{
    let current = true;
    reviewDeletion(client,photos).then(value=>{if(current)setReviews(value);});
    return ()=>{current=false;};
  },[client,photos]);

  async function confirm() {
    if (!reviews || saving) return;
    setSaving(true);
    try {
      const outcome = await deleteReviewedPhotos(client,reviews);
      onDeleted(outcome.removed);
      setResult(outcome);
    } finally {
      setSaving(false);
    }
  }

  const allowed = reviews?.filter(canPurge).length ?? 0;
  const alreadyDeleted = reviews?.filter(row=>row.impact?.deleted).length ?? 0;
  const kept = (reviews?.length ?? 0) - allowed - alreadyDeleted;
  const rows = result ? result.kept : reviews;
  return <Modal title={result?'Deletion results':'Delete permanently'} onClose={()=>{if(!saving)onClose();}}>
    {!reviews&&<p role="status">Checking albums and related photos…</p>}
    {result?<p role="status">{result.removed.length} deleted · {result.kept.length} kept</p>:reviews&&<>
      <p>{allowed} can be deleted{kept>0?' · '+kept+' will be kept':''}</p>
      {allowed>0&&<p className="muted small">Permanent deletion cannot be undone.</p>}
    </>}
    {rows?.length>0&&<ul className="purge-review">{rows.map(row=><DeleteReviewRow key={row.photo.id} review={row}/>)}</ul>}
    {rows?.some(row=>!canPurge(row)&&row.impact?.links?.length>0)&&
      <p className="muted small">Restore a photo to remove it from an album. Linked creations need to be removed first.</p>}
    <footer className="modal-footer">
      <Button disabled={saving} onClick={onClose}>{result?'Done':allowed?'Cancel':'Close'}</Button>
      {!result&&(allowed>0||alreadyDeleted>0)&&<button className="button danger-button" disabled={saving} onClick={confirm}>
        {saving?'Deleting…':allowed?'Delete '+allowed+' permanently':'Refresh Trash'}
      </button>}
    </footer>
  </Modal>;
}
