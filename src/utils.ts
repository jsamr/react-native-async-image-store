const urlRegex = new RegExp('^\\/|\\/$', 'g')

function joinUrlElements(rootURI: string, ...uris: string[]) {
  const args = Array.prototype.slice.call([rootURI, ...uris])
  return args.map((element: string) => {
    return element.replace(urlRegex, '')
  }).join('/')
}

export function joinUri(url: string, ...args: string[]): string {
  return joinUrlElements(url, ...args)
}
