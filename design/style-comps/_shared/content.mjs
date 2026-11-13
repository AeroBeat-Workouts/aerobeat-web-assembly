// Home-screen content shared by every style comp. Generated from
// design/hand-ui/assets/data.js (real BeatSaver playlists). Same content in every
// comp so they compete on style only.
//
// Cover paths are relative to design/hand-ui/assets/; use coverUrl() to resolve.

export const content = {
  "playlistOfTheDay": {
    "label": "sonic",
    "name": "Silver Songs",
    "owner": "SilverH06",
    "source": "beatsaver",
    "songCount": 20,
    "cover": "covers/playlist-sonic.jpg",
    "memberCovers": [
      "covers/map-sonic-0.jpg",
      "covers/map-sonic-1.jpg",
      "covers/map-sonic-2.jpg",
      "covers/map-sonic-3.jpg"
    ]
  },
  "recommended": [
    {
      "label": "linkin-park",
      "name": "Linkin Park",
      "owner": "Neflarg",
      "source": "beatsaver",
      "songCount": 13,
      "cover": "covers/playlist-linkin-park.jpg",
      "memberCovers": [
        "covers/map-linkin-park-0.jpg",
        "covers/map-linkin-park-1.jpg",
        "covers/map-linkin-park-2.jpg",
        "covers/map-linkin-park-3.jpg"
      ]
    },
    {
      "label": "Mega Man",
      "name": "Mega Man",
      "owner": "AeroBeat",
      "source": "aerobeat-authored",
      "songCount": 10,
      "cover": null,
      "memberCovers": [
        "covers/map-Mega Man-0.jpg",
        "covers/map-Mega Man-1.jpg",
        "covers/map-Mega Man-2.jpg",
        "covers/map-Mega Man-3.jpg"
      ]
    },
    {
      "label": "Game Grumps",
      "name": "Game Grumps",
      "owner": "AeroBeat",
      "source": "aerobeat-authored",
      "songCount": 5,
      "cover": null,
      "memberCovers": [
        "covers/map-Game Grumps-0.jpg",
        "covers/map-Game Grumps-1.jpg",
        "covers/map-Game Grumps-2.jpg",
        "covers/map-Game Grumps-3.jpg"
      ]
    }
  ]
};

export function coverUrl(path) {
  return path ? new URL("../../hand-ui/assets/" + path, import.meta.url).href : null;
}
