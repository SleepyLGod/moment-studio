async function reviewPhoto(client, photo) {
  try {
    return {photo, impact:await client.deletionImpact(photo.id)};
  } catch (error) {
    return {photo, problem:error.message};
  }
}

export async function reviewDeletion(client, photos) {
  const reviews = [];
  for (let i = 0; i < photos.length; i += 6) {
    reviews.push(...await Promise.all(photos.slice(i, i + 6).map(photo=>reviewPhoto(client, photo))));
  }
  return reviews;
}

export function canPurge({impact,problem}) {
  return Boolean(!problem && impact && !impact.deleted && (impact.pending || !impact.links.length));
}

export async function deleteReviewedPhotos(client, reviews) {
  const removed = [];
  const kept = [];
  for (const review of reviews) {
    const {photo,impact} = review;
    if (impact?.deleted) {
      removed.push(photo.id);
      continue;
    }
    if (!canPurge(review)) {
      kept.push(review);
      continue;
    }
    try {
      const result = await client.purgePhoto(photo.id, impact.token);
      if (result.deleted !== true) throw new Error('Deletion could not be confirmed.');
      removed.push(photo.id);
    } catch (error) {
      // The request may have completed or references may have changed since review.
      const latest = await reviewPhoto(client, photo);
      if (latest.impact?.deleted) removed.push(photo.id);
      else kept.push({...latest,problem:latest.problem || error.message});
    }
  }
  return {removed,kept};
}
