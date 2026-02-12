import fs from "node:fs";
import path from "node:path";
import { generateBlend } from "./generateBlend";
import type { BlendInput, InputUser } from "./types";

function readJson<T>(p: string): T {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const root = process.cwd(); // when run from /server this is server/
const spotifyPath = path.join(root, "fixtures", "spotify_sample.json");
const applePath = path.join(root, "fixtures", "apple_sample.json");

const spotifyUser = readJson<InputUser>(spotifyPath);
const appleUser = readJson<InputUser>(applePath);

const input: BlendInput = {
    roomId: "mock-room",
    users: [spotifyUser, appleUser],
};

const out = generateBlend(input, 40);

console.log(JSON.stringify(out, null, 2));
