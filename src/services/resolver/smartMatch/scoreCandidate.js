/**
 * Deterministic Candidate Scoring Engine for Spotify Smart Match
 */

const { normalizeTitle, normalizeArtist, normalizeAlbum, extractVersionMarkers } = require('./normalizers');

function scoreCandidate(spotifyMeta, candidate, debug = false) {
  let score = 0;
  const penalties = [];
  const bonuses = [];

  const targetTitleNorm = normalizeTitle(spotifyMeta.title);
  const targetArtistNorm = normalizeArtist(spotifyMeta.artist || spotifyMeta.primaryArtist);
  const targetAlbumNorm = normalizeAlbum(spotifyMeta.album || '');
  const targetDuration = spotifyMeta.duration; // seconds or null

  const candTitleRaw = candidate.title || '';
  const candTitleNorm = normalizeTitle(candTitleRaw);
  const candArtistNorm = normalizeArtist(candidate.artist || candidate.uploader || candidate.channel || '');
  const candAlbumNorm = normalizeAlbum(candidate.album || '');
  const candDuration = candidate.duration;

  // 1. ISRC Match (+100)
  if (spotifyMeta.isrc && candidate.isrc && spotifyMeta.isrc === candidate.isrc) {
    score += 100;
    bonuses.push('Exact ISRC (+100)');
  } else if (spotifyMeta.isrc && candidate.isrc && spotifyMeta.isrc !== candidate.isrc) {
    score -= 80;
    penalties.push('Wrong ISRC (-80)');
  }

  // 2. Title Matching
  if (targetTitleNorm === candTitleNorm) {
    score += 35;
    bonuses.push('Exact Title (+35)');
  } else if (candTitleNorm.includes(targetTitleNorm) || targetTitleNorm.includes(candTitleNorm)) {
    score += 25;
    bonuses.push('Close Title (+25)');
  }

  // 3. Artist Matching
  const primaryArtist = spotifyMeta.primaryArtist ? normalizeArtist(spotifyMeta.primaryArtist) : targetArtistNorm;
  const allArtists = (spotifyMeta.artists || [primaryArtist]).map(a => normalizeArtist(a));
  const candArtistFull = (candArtistNorm + ' ' + candTitleNorm).toLowerCase();

  let primaryMatched = false;
  if (primaryArtist && (candArtistNorm.includes(primaryArtist) || candTitleNorm.includes(primaryArtist) || candArtistFull.includes(primaryArtist.replace(/\s+/g, '')))) {
    score += 35;
    bonuses.push('Primary Artist Match (+35)');
    primaryMatched = true;
  } else if (candArtistNorm && primaryArtist && (primaryArtist.includes(candArtistNorm) || candArtistNorm.includes(primaryArtist))) {
    score += 25;
    bonuses.push('Partial Artist Match (+25)');
    primaryMatched = true;
  } else {
    score -= 70;
    penalties.push('Wrong Primary Artist (-70)');
  }

  // Check all artists match
  let allMatched = true;
  for (const art of allArtists) {
    if (art && !candArtistFull.includes(art)) {
      allMatched = false;
      break;
    }
  }
  if (allMatched && allArtists.length > 1) {
    score += 10;
    bonuses.push('All Artists Matched (+10)');
  }

  // 4. Duration Matching
  if (targetDuration && candDuration) {
    const diff = Math.abs(targetDuration - candDuration);
    if (diff <= 2) {
      score += 20;
      bonuses.push('Duration diff <= 2s (+20)');
    } else if (diff <= 4) {
      score += 15;
      bonuses.push('Duration diff <= 4s (+15)');
    } else if (diff <= 7) {
      score += 8;
      bonuses.push('Duration diff <= 7s (+8)');
    } else if (diff > 20) {
      score -= 70;
      penalties.push(`Duration diff > 20s (${diff}s) (-70)`);
    } else if (diff > 10) {
      score -= 40;
      penalties.push(`Duration diff > 10s (${diff}s) (-40)`);
    }
  }

  // 5. Album Match
  if (targetAlbumNorm && candAlbumNorm && targetAlbumNorm === candAlbumNorm) {
    score += 10;
    bonuses.push('Exact Album Match (+10)');
  }

  // 6. Channel / Source Status
  const uploaderLower = (candidate.uploader || candidate.channel || '').toLowerCase();
  if (uploaderLower.includes('topic')) {
    score += 8;
    bonuses.push('Official Topic Channel (+8)');
  }
  if (candidate.isOfficialArtistChannel || uploaderLower.includes('vevo') || uploaderLower.includes(primaryArtist)) {
    score += 8;
    bonuses.push('Official Artist Channel (+8)');
  }
  if (candTitleRaw.toLowerCase().includes('official audio')) {
    score += 6;
    bonuses.push('Official Audio Tag (+6)');
  }
  if (candidate.isStructuredMusic) {
    score += 10;
    bonuses.push('Structured Music Result (+10)');
  }

  // 7. Version Penalties (Selective version matching)
  const targetVersionMarkers = extractVersionMarkers(spotifyMeta.title);
  const candVersionMarkers = extractVersionMarkers(candTitleRaw);

  for (const marker of candVersionMarkers) {
    // Only penalize if Spotify title does NOT contain this marker
    if (!targetVersionMarkers.includes(marker)) {
      switch (marker) {
        case 'reaction':
        case 'tutorial':
          score -= 100;
          penalties.push(`Contains unwanted '${marker}' (-100)`);
          break;
        case 'karaoke':
        case 'nightcore':
          score -= 70;
          penalties.push(`Contains unwanted '${marker}' (-70)`);
          break;
        case 'cover':
        case 'instrumental':
        case 'slowed':
        case 'sped up':
        case '8d':
        case 'live':
        case 'remix':
          score -= 60;
          penalties.push(`Contains unwanted '${marker}' (-60)`);
          break;
        case 'edit':
          score -= 30;
          penalties.push(`Contains unwanted '${marker}' (-30)`);
          break;
        case 'lyrics':
          score -= 20;
          penalties.push(`Contains unwanted '${marker}' (-20)`);
          break;
        case 'acoustic':
        case 'remastered':
        case 'radio edit':
          score -= 30;
          penalties.push(`Contains unwanted '${marker}' (-30)`);
          break;
      }
    }
  }

  let confidenceLabel = 'REJECT';
  if (score >= 90) confidenceLabel = 'VERY HIGH';
  else if (score >= 80) confidenceLabel = 'HIGH';
  else if (score >= 70) confidenceLabel = 'MEDIUM';

  const result = {
    score,
    confidenceLabel,
    pass: score >= 80,
    bonuses,
    penalties,
    candidate
  };

  if (debug || process.env.NODE_ENV === 'development') {
    console.log(`[SmartMatch Debug] Cand: "${candTitleRaw}" | Score: ${score} | Conf: ${confidenceLabel} | Pass: ${result.pass}`);
    if (penalties.length) console.log(`   Penalties: ${penalties.join(', ')}`);
  }

  return result;
}

module.exports = { scoreCandidate };
