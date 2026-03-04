import { isYoutubeLink, isPlaylistLink, fixPlaylistLink } from "./utils";

describe("isYoutubeLink", () => {
  it("returns true for youtube.com watch URLs", () => {
    expect(isYoutubeLink("https://www.youtube.com/watch?v=95jus0d_c14")).toBe(
      true
    );
  });

  it("returns true for youtu.be short URLs", () => {
    expect(isYoutubeLink("https://youtu.be/aodbq2elxxs?t=14s")).toBe(true);
  });

  it("returns false for non-YouTube URLs", () => {
    expect(isYoutubeLink("https://example.com")).toBe(false);
    expect(isYoutubeLink("https://vimeo.com/123")).toBe(false);
  });
});

describe("isPlaylistLink", () => {
  it("returns true for playlist URL with list param", () => {
    expect(
      isPlaylistLink(
        "https://www.youtube.com/watch?v=shF8Sv-OswM&list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU"
      )
    ).toBe(true);
  });

  it("returns true for playlist page URL", () => {
    expect(
      isPlaylistLink(
        "https://www.youtube.com/playlist?list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU"
      )
    ).toBe(true);
  });

  it("returns false for plain video URL without list", () => {
    expect(isPlaylistLink("https://www.youtube.com/watch?v=abc")).toBe(false);
  });
});

describe("fixPlaylistLink", () => {
  it("returns link unchanged if already playlist page URL", () => {
    const link =
      "https://www.youtube.com/playlist?list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU";
    expect(fixPlaylistLink(link)).toBe(link);
  });

  it("converts watch URL with list param to playlist URL", () => {
    const watchLink =
      "https://www.youtube.com/watch?v=shF8Sv-OswM&list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU";
    expect(fixPlaylistLink(watchLink)).toBe(
      "https://www.youtube.com/playlist?list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU"
    );
  });

  it("returns link unchanged if not a playlist link", () => {
    const link = "https://www.youtube.com/watch?v=abc";
    expect(fixPlaylistLink(link)).toBe(link);
  });
});
