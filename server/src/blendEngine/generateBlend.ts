import type { BlendInput, BlendOutput, OutputTrack, PickedFor } from "./types";

type Params = {
    w_shared: number;
    w_artist: number;
    w_rank: number;
    sourceBonus: Record<string, number>;
    artistCap: number;
    capUserSlack: number; // the +2
    maxSpicePerUser: number; // 0/1 recommended
    maxRunSameUser: number; // soft constraint (e.g. 3)
};

const DEFAULT_PARAMS: Params = {
    w_shared: 0.55,
    w_artist: 0.25,
    w_rank: 0.2,
    sourceBonus: { heavyRotation: 0.08, top: 0.05, recentlyAdded: 0.02 },
    artistCap: 2,
    capUserSlack: 2,
    maxSpicePerUser: 1,
    maxRunSameUser: 3,
};

function slug(s: string): string {
    return s
        .toLowerCase()
        .replace(/\(.*?\)/g, " ")           // remove (feat...) etc
        .replace(/\bfeat\.?\b/g, " ")
        .replace(/\bft\.?\b/g, " ")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function normArtist(a: string): string {
    return slug(a);
}

function canonicalIdOf(t: { isrc?: string; title: string; artist: string }): string {
    const isrc = (t.isrc ?? "").trim();
    if (isrc) return `isrc:${isrc.toUpperCase()}`;
    return `${slug(t.title)}||${slug(t.artist)}`;
}

function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
}

export function generateBlend(input: BlendInput, K = 40, params: Partial<Params> = {}): BlendOutput {
    const p: Params = { ...DEFAULT_PARAMS, ...params };
    const users = input.users ?? [];
    const U = Math.max(1, users.length);

    // --- Gather contributions
    type Contrib = {
        userId: string;
        provider: string;
        source: string;
        rank: number;
        id: string;
        title: string;
        artist: string;
        isrc?: string;
    };

    const contribs: Contrib[] = [];
    for (const u of users) {
        for (const tr of u.tracks ?? []) {
            contribs.push({
                userId: u.userId,
                provider: u.provider,
                source: tr.source,
                rank: tr.rank,
                id: tr.id,
                title: tr.title,
                artist: tr.artist,
                isrc: tr.isrc,
            });
        }
    }

    // If no tracks at all, return empty safely
    if (contribs.length === 0) {
        return {
            tracks: [],
            stats: {
                perUserCounts: Object.fromEntries(users.map(u => [u.userId, 0])),
                perArtistCounts: {},
                artistCap: p.artistCap,
                userCap: 0,
            },
        };
    }

    // --- Group by canonicalId
    type Group = {
        canonicalId: string;
        title: string;
        artist: string;
        artistKey: string;
        isrc?: string;
        providerIds: { spotify?: string; apple?: string };
        contribs: Contrib[];
    };

    const groupsById = new Map<string, Group>();

    for (const c of contribs) {
        const cid = canonicalIdOf(c);
        const artistKey = normArtist(c.artist);
        const existing = groupsById.get(cid);

        if (!existing) {
            // <-- providerIds goes RIGHT HERE for a new group
            const providerIds: { spotify?: string; apple?: string } = {};
            if (c.provider === "spotify") providerIds.spotify = c.id;
            if (c.provider === "apple") providerIds.apple = c.id;

            groupsById.set(cid, {
                canonicalId: cid,
                title: c.title,
                artist: c.artist,
                artistKey,
                isrc: c.isrc,
                providerIds,
                contribs: [c],
            });
        } else {
            // <-- and HERE for merging into an existing group
            existing.contribs.push(c);

            if (c.isrc && !existing.isrc) existing.isrc = c.isrc;

            if (c.provider === "spotify" && !existing.providerIds.spotify) {
                existing.providerIds.spotify = c.id;
            }
            if (c.provider === "apple" && !existing.providerIds.apple) {
                existing.providerIds.apple = c.id;
            }
        }
    }


    const groups = [...groupsById.values()];

    // --- sharedCount per track (distinct users)
    const sharedCount = new Map<string, number>();
    for (const g of groups) {
        const distinctUsers = new Set(g.contribs.map(c => c.userId));
        sharedCount.set(g.canonicalId, distinctUsers.size);
    }

    // --- artistSharedCount (how many users have any track by artist)
    const artistUsers = new Map<string, Set<string>>();
    for (const g of groups) {
        const set = artistUsers.get(g.artistKey) ?? new Set<string>();
        for (const c of g.contribs) set.add(c.userId);
        artistUsers.set(g.artistKey, set);
    }
    const artistSharedCount = (artistKey: string) => (artistUsers.get(artistKey)?.size ?? 0);

    // --- Build one "candidate" per (track group, owner user)
    // We pick the best contribution per user (lowest rank + best source bonus)
    type Candidate = {
        canonicalId: string;
        title: string;
        artist: string;
        artistKey: string;

        isrc?: string;
        providerIds: { spotify?: string; apple?: string };

        ownerUserId: string;
        bestSource: string;
        bestRank: number;
        score: number;

        pickedFor: "shared" | string; // keep your new behavior
        explain: string;
    };



    function sourceBonus(src: string) {
        return p.sourceBonus[src] ?? 0;
    }

    const candidates: Candidate[] = [];

    for (const g of groups) {
        // group contributions by user
        const byUser = new Map<string, Contrib[]>();
        for (const c of g.contribs) {
            const arr = byUser.get(c.userId) ?? [];
            arr.push(c);
            byUser.set(c.userId, arr);
        }

        for (const [userId, arr] of byUser.entries()) {
            // best contrib for that user
            arr.sort((a, b) => {
                // primary: lower rank, secondary: higher source bonus
                if (a.rank !== b.rank) return a.rank - b.rank;
                return sourceBonus(b.source) - sourceBonus(a.source);
            });
            const best = arr[0];

            const sc = (sharedCount.get(g.canonicalId) ?? 1) / U;
            const ac = artistSharedCount(g.artistKey) / U;
            const rankScore = 1 / (1 + Math.max(1, best.rank));
            const score =
                p.w_shared * sc +
                p.w_artist * ac +
                p.w_rank * rankScore +
                sourceBonus(best.source);

            // bucket label
            const sharedN = sharedCount.get(g.canonicalId) ?? 1;
            const pickedFor: PickedFor = sharedN >= 2 ? "shared" : userId;

            const reasons: string[] = [];
            if (sharedN >= 2) reasons.push(`shared by ${sharedN} users`);
            const aN = artistSharedCount(g.artistKey);
            if (aN >= 2) reasons.push(`artist overlap (${aN} users)`);
            reasons.push(`${best.source} rank ${best.rank}`);

            candidates.push({
                canonicalId: g.canonicalId,
                title: g.title,
                artist: g.artist,
                artistKey: g.artistKey,

                isrc: g.isrc,
                providerIds: g.providerIds,

                ownerUserId: userId,
                bestSource: best.source,
                bestRank: best.rank,
                score: clamp01(score),
                pickedFor,
                explain: reasons.join("; "),
            });


        }
    }

    // --- Sort by score desc
    candidates.sort((a, b) => b.score - a.score);

    // --- Selection with constraints
    const userCap = Math.ceil(K / U) + p.capUserSlack;
    const perUserCounts: Record<string, number> = Object.fromEntries(users.map(u => [u.userId, 0]));
    const perArtistCounts: Record<string, number> = {};
    const spicePerUser: Record<string, number> = Object.fromEntries(users.map(u => [u.userId, 0]));

    const pickedCanonical = new Set<string>();
    const selected: Candidate[] = [];

    let currentArtistCap = p.artistCap;

    function canAdd(c: Candidate): boolean {
        if (pickedCanonical.has(c.canonicalId)) return false;

        const uCount = perUserCounts[c.ownerUserId] ?? 0;
        if (uCount >= userCap) return false;

        const aCount = perArtistCounts[c.artistKey] ?? 0;
        if (aCount >= currentArtistCap) return false;

        if (c.pickedFor === "spice" && (spicePerUser[c.ownerUserId] ?? 0) >= p.maxSpicePerUser) return false;

        // soft constraint: max run of same user
        if (p.maxRunSameUser > 0 && selected.length >= p.maxRunSameUser) {
            const lastN = selected.slice(-p.maxRunSameUser);
            if (lastN.every(x => x.ownerUserId === c.ownerUserId)) return false;
        }

        return true;
    }

    // pass 1 with strict artist cap
    for (const c of candidates) {
        if (selected.length >= K) break;
        if (!canAdd(c)) continue;

        selected.push(c);
        pickedCanonical.add(c.canonicalId);
        perUserCounts[c.ownerUserId] = (perUserCounts[c.ownerUserId] ?? 0) + 1;
        perArtistCounts[c.artistKey] = (perArtistCounts[c.artistKey] ?? 0) + 1;
        if (c.pickedFor === "spice") spicePerUser[c.ownerUserId] = (spicePerUser[c.ownerUserId] ?? 0) + 1;
    }

    // pass 2: if we didn't fill K, loosen artist cap to 3
    if (selected.length < K) {
        currentArtistCap = Math.max(currentArtistCap, 3);
        for (const c of candidates) {
            if (selected.length >= K) break;
            if (!canAdd(c)) continue;

            selected.push(c);
            pickedCanonical.add(c.canonicalId);
            perUserCounts[c.ownerUserId] = (perUserCounts[c.ownerUserId] ?? 0) + 1;
            perArtistCounts[c.artistKey] = (perArtistCounts[c.artistKey] ?? 0) + 1;
            if (c.pickedFor === "spice") spicePerUser[c.ownerUserId] = (spicePerUser[c.ownerUserId] ?? 0) + 1;
        }
    }

    const outTracks: OutputTrack[] = selected.map(s => ({
        canonicalId: s.canonicalId,
        title: s.title,
        artist: s.artist,
        isrc: s.isrc,
        providerIds: s.providerIds,
        sourceUserId: s.ownerUserId,
        score: s.score,
        pickedFor: [s.pickedFor],
        explain: s.explain,
        fallbackQuery: `${s.artist} ${s.title}`.trim(),
    }));




    return {
        tracks: outTracks,
        stats: {
            perUserCounts,
            perArtistCounts,
            artistCap: currentArtistCap,
            userCap,
        },
    };
}