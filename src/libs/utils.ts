/**
 * Returns true if link is a valid youtube link
 *
 * @param {string} link
 *
 * @return {boolean}
 *
 * @example
 *      isYoutubeLink('https://www.youtube.com/watch?v=95jus0d_c14')
 *      isYoutubeLink('https://youtu.be/aodbq2elxxs?t=14s')
 */
export function isYoutubeLink(link) {
  return link.indexOf("youtube.com") > -1 || link.indexOf("youtu.be") > -1;
}

/**
 * Returns true if link is a valid youtube playlist link
 *
 * @param {string} link
 *
 * @return {boolean}
 *
 * @example
 *      isPlaylistLink('https://www.youtube.com/watch?v=shF8Sv-OswM&list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU')
 *      isPlaylistLink('https://www.youtube.com/playlist?list=PLzIUZKHPb1HbqsPMIFdE0My54iektZrNU')
 */
export function isPlaylistLink(link) {
  return isYoutubeLink(link) && link.includes("list");
}

/**
 * Auxiliary function for youtube-dl.
 * @see https://github.com/przemyslawpluta/node-youtube-dl/issues/271
 *
 * @param {string} link
 *
 * @return {string}
 */
export function fixPlaylistLink(link) {
  if (isPlaylistLink(link)) {
    if (link.includes("playlist")) {
      return link;
    } else {
      const aux = link.indexOf("&list=");
      const auxlink = link.substring(aux + 1);
      return `https://www.youtube.com/playlist?${auxlink}`;
    }
  } else {
    // Not a playlist link
    return link;
  }
}

/**
 * Parses missing title for the WBM html
 *
 * @param {string} body
 *
 * @return {string}
 */
export function parseTitleWBM(body) {
  let filename = "";
  // const a = '[Deleted video] #'+ key + '.txt'
  // let b = path.join('assets/recovered/', a)
  // let c = fs.writeFileSync(b, body)
  const regExps = ['"title":"(.*?)"', "<title.*?>(.*?)</title>"];
  for (let i = 0; i < regExps.length; i++) {
    const regex = new RegExp(regExps[i], "g");
    const titleMatch = regex.exec(body);
    if (titleMatch && titleMatch.length > 0) {
      console.log(titleMatch);
      filename = titleMatch[1];
      break;
    }
  }
  return filename;
}
