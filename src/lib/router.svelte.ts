// Hash routing. Routes:
//   #/                     the tree
//   #/h/<hobby>[/<node>]   the tree, with a hobby (and optionally a node) open
//   #/g/<domain>/<sub>     the tree, with a sub-category open
//   #/map[/<a>/<b>]        the category heat map, optionally with a cell selected
//   #/traits[/<trait>]     the trait explorer
//   #/me                   character sheet

export type Route =
  | { view: 'tree'; hobby?: string; node?: string; group?: string }
  | { view: 'map'; a?: string; b?: string }
  | { view: 'traits'; trait?: string }
  | { view: 'me' };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'h': return { view: 'tree', hobby: parts[1], node: parts[2] };
    case 'g': return { view: 'tree', group: parts[1] && parts[2] ? `${parts[1]}/${parts[2]}` : undefined };
    case 'map': return { view: 'map', a: parts[1], b: parts[2] };
    case 'traits': return { view: 'traits', trait: parts[1] };
    case 'me': return { view: 'me' };
    default: return { view: 'tree' };
  }
}

export const router = $state({ route: parse(location.hash) });
addEventListener('hashchange', () => (router.route = parse(location.hash)));

export function href(r: Route): string {
  switch (r.view) {
    case 'tree': return r.hobby ? `#/h/${r.hobby}${r.node ? '/' + r.node : ''}` : r.group ? `#/g/${r.group}` : '#/';
    case 'map': return r.a && r.b ? `#/map/${r.a}/${r.b}` : '#/map';
    case 'traits': return r.trait ? `#/traits/${r.trait}` : '#/traits';
    case 'me': return '#/me';
  }
}

export const go = (r: Route) => (location.hash = href(r));
