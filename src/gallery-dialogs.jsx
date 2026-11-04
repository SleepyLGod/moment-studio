import React, {useEffect, useState} from 'react';
import {Button, Modal} from './components';

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

export function DeletePhotoDialog({photo,client,onClose,onDeleted}) {
  const [review,setReview] = useState(null);
  const [problem,setProblem] = useState('');
  const [saving,setSaving] = useState(false);

  useEffect(()=>{
    let current = true;
    client.deletionImpact(photo.id).then(value=>{
      if (current) setReview(value);
    }).catch(error=>{
      if (current) setProblem(error.message);
    });
    return ()=>{current=false;};
  },[client,photo.id]);

  async function confirm() {
    if (!review || saving) return;
    if (review.deleted) {onDeleted(photo.id);return;}
    setSaving(true);
    setProblem('');
    try {
      await client.purgePhoto(photo.id,review.token);
      onDeleted(photo.id);
    } catch (error) {
      setProblem(error.message);
      setReview(null);
      try { setReview(await client.deletionImpact(photo.id)); }
      catch (refreshError) { setProblem(refreshError.message); }
    } finally {
      setSaving(false);
    }
  }

  const blocked = review && !review.pending && review.links?.length > 0;
  return <Modal title="Delete permanently" onClose={()=>{if (!saving) onClose();}}>
    <p className="purge-name">{photo.name}</p>
    {problem&&<p className="purge-problem" role="alert">{problem}</p>}
    {!review&&!problem&&<p role="status">Checking albums and related photos…</p>}
    {review?.deleted&&<p>This photo has already been permanently deleted.</p>}
    {blocked&&<>
      <p>These items still use this photo. Resolve the links before deleting it.</p>
      <ul className="purge-links">{review.links.map(link=><li key={link.kind+'-'+link.id}>
        <span>{link.name||'Untitled'}</span>
        <small>{linkLabel[link.kind]||'Photo'}{link.trashed?' · In Trash':''}</small>
      </li>)}</ul>
      {review.moreLinks&&<p>More linked items are present.</p>}
      <p className="muted small">Restore the photo to remove it from an album. Delete any linked creations first.</p>
    </>}
    {review&&!blocked&&!review.deleted&&<>
      <p>{review.pending?'Deletion started. Finish clearing the reserved files.':'Permanently remove this photo from the library. This cannot be undone.'}</p>
      <p className="muted small">{review.filesToDelete} file{review.filesToDelete===1?'':'s'} to remove{review.filesToKeep>0?' · '+review.filesToKeep+' shared kept':''}</p>
    </>}
    <footer className="modal-footer">
      <Button disabled={saving} onClick={onClose}>{blocked?'Close':'Cancel'}</Button>
      {review&&!blocked&&<button className="button danger-button" disabled={saving} onClick={confirm}>
        {saving?'Deleting…':review.deleted?'Done':review.pending?'Finish deletion':'Delete permanently'}
      </button>}
    </footer>
  </Modal>;
}
