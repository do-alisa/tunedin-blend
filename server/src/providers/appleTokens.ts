let appleMusicUserToken: string | null = null;

export function setAppleMusicUserToken(token: string) {
    appleMusicUserToken = token;
}

export function getAppleMusicUserToken() {
    return appleMusicUserToken;
}
