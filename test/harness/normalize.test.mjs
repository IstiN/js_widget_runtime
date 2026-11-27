import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTree, normalizeColor, isScrollableType } from '../../harness/normalize.mjs';

test('style merges into props, node keys win, style removed', () => {
  const tree = normalizeTree({ type: 'text', data: 'x', fontSize: 24, style: { fontSize: 99, color: '#abc' } });
  assert.deepEqual(tree.props, { data: 'x', fontSize: 24, color: '#AABBCC' });
  assert.equal('style' in tree, false);
});

test('on* string props move to events, non-string on* props stay', () => {
  const tree = normalizeTree({ type: 'button', onTap: 'go', onHover: 3 });
  assert.deepEqual(tree.events, { onTap: 'go' });
  assert.equal(tree.props.onHover, 3);
});

test('existing events map is kept and merged', () => {
  const tree = normalizeTree({ type: 'b', events: { onLongPress: 'lp' }, onTap: 't' });
  assert.deepEqual(tree.events, { onLongPress: 'lp', onTap: 't' });
});

test('child object promotes to children, child string becomes a text node', () => {
  const fromObject = normalizeTree({ type: 'column', child: { type: 'text', data: 'a' } });
  assert.equal(fromObject.children.length, 1);
  assert.equal(fromObject.children[0].type, 'text');
  assert.equal(fromObject.children[0].props.data, 'a');
  const fromString = normalizeTree({ type: 'column', child: 'hello' });
  assert.deepEqual(fromString.children[0].props, { data: 'hello' });
});

test('items promote to children (reference semantics)', () => {
  const tree = normalizeTree({ type: 'row', items: [{ type: 'text', data: 'a' }] });
  assert.equal(tree.children.length, 1);
  assert.equal('items' in tree, false);
});

test('children may contain bare strings', () => {
  const tree = normalizeTree({ type: 'column', children: ['a', { type: 'text', data: 'b' }] });
  assert.equal(tree.children[0].type, 'text');
  assert.deepEqual(tree.children[0].props, { data: 'a' });
  assert.deepEqual(tree.children[1].props, { data: 'b' });
});

test('key prop and __iid transport tag are removed', () => {
  const tree = normalizeTree({ type: 'text', data: 'x', key: 'k1', __iid: 'w1' });
  assert.equal('key' in tree, false);
  assert.equal('__iid' in tree, false);
});

test('type aliases resolve (exact, then lowercase)', () => {
  assert.equal(normalizeTree({ type: 'Text' }).type, 'text');
  assert.equal(normalizeTree({ type: 'ElevatedButton' }).type, 'button');
  assert.equal(normalizeTree({ type: 'View' }).type, 'column');
  assert.equal(normalizeTree({ type: 'COLUMN' }).type, 'COLUMN'); // no bare 'column' key in the reference table
  assert.equal(normalizeTree({ type: 'customThing' }).type, 'customThing');
});

test('colors normalize to upper-case #RRGGBB[AA]; non-color keys untouched', () => {
  const tree = normalizeTree({ type: 'text', data: 'x', color: '#abc', backgroundColor: '#AbCd', borderColor: '#aabbccdd', shadowColor: 'rgb(1, 2, 3)', fontSize: 10 });
  assert.equal(tree.props.color, '#AABBCC');
  assert.equal(tree.props.backgroundColor, '#AABBCCDD');
  assert.equal(tree.props.borderColor, '#AABBCCDD');
  assert.equal(tree.props.shadowColor, '#010203');
  assert.equal(tree.props.fontSize, 10);
});

test('normalizeColor handles rgba alpha and leaves unknown strings', () => {
  assert.equal(normalizeColor('rgba(255, 0, 0, 0.5)'), '#FF000080');
  assert.equal(normalizeColor('#f1f5f9'), '#F1F5F9');
  assert.equal(normalizeColor('red'), 'red');
  assert.equal(normalizeColor(42), 42);
});

test('nested prop objects normalize colors too', () => {
  const tree = normalizeTree({ type: 'container', decoration: { color: '#abc', radius: 4 }, gradient: [{ color: '#112233' }] });
  assert.equal(tree.props.decoration.color, '#AABBCC');
  assert.equal(tree.props.gradient[0].color, '#112233');
});

test('nodeId assignment is depth-first pre-order from n0', () => {
  const tree = normalizeTree({
    type: 'column',
    children: [
      { type: 'text', data: 'a' },
      { type: 'row', children: [{ type: 'text', data: 'b' }] },
      'c',
    ],
  });
  assert.equal(tree.nodeId, 'n0');
  assert.equal(tree.children[0].nodeId, 'n1');
  assert.equal(tree.children[1].nodeId, 'n2');
  assert.equal(tree.children[1].children[0].nodeId, 'n3');
  assert.equal(tree.children[2].nodeId, 'n4');
});

test('normalizeTree accepts the v0.1 { root: ... } wrapper', () => {
  const tree = normalizeTree({ root: { type: 'text', data: 'x' } });
  assert.equal(tree.type, 'text');
});

test('normalizeTree is idempotent (a normalized node maps to itself)', () => {
  const once = normalizeTree({ type: 'column', spacing: 8, children: [{ type: 'textButton', text: 'go', data: 'go', onTap: 'a' }, { type: 'text', data: 'x', style: { color: '#abc' } }] });
  assert.deepEqual(normalizeTree(once), once);
});

test('reference field aliases: buttons, boxes, inputs, images, svg, values', () => {
  // button labels: title/text move to data (reference removes the source prop)
  assert.deepEqual(normalizeTree({ type: 'button', title: 'Hi' }).props, { data: 'Hi' });
  assert.deepEqual(normalizeTree({ type: 'textButton', text: 'Go' }).props, { data: 'Go' });
  // both present: stays unchanged (live text on dumps)
  assert.deepEqual(normalizeTree({ type: 'textButton', text: 'Go', data: 'Go' }).props, { text: 'Go', data: 'Go' });
  // text content: content -> data; label -> data only for text nodes (label kept)
  assert.deepEqual(normalizeTree({ type: 'text', content: 'C' }).props, { data: 'C' });
  const labeled = normalizeTree({ type: 'text', label: 'L' });
  assert.equal(labeled.props.data, 'L');
  assert.equal(labeled.props.label, 'L');
  // boxes: backgroundColor / container color wrap into decoration.color
  assert.deepEqual(normalizeTree({ type: 'container', backgroundColor: '#abc' }).props, { decoration: { color: '#AABBCC' } });
  assert.deepEqual(normalizeTree({ type: 'card', color: '#123456' }).props, { color: '#123456' }); // plain color stays for card (reference)
  assert.deepEqual(normalizeTree({ type: 'container', color: '#123456' }).props, { decoration: { color: '#123456' } });
  // inputs: placeholder -> hint, value -> initialValue, input type canonicalized
  const input = normalizeTree({ type: 'input', placeholder: 'Name', value: 'Ada' });
  assert.equal(input.type, 'textField');
  assert.deepEqual(input.props, { hint: 'Name', initialValue: 'Ada' });
  // images: uri/source -> url
  assert.deepEqual(normalizeTree({ type: 'img', uri: 'a.png' }).props, { url: 'a.png' });
  assert.deepEqual(normalizeTree({ type: 'networkImage', source: 'b.png' }).props, { url: 'b.png' });
  // svg markup -> data
  assert.deepEqual(normalizeTree({ type: 'svg', markup: '<x/>' }).props, { data: '<x/>' });
  // value types and dropdowns: onChanged -> onChange
  assert.deepEqual(normalizeTree({ type: 'slider', onChanged: 'slide' }).events, { onChange: 'slide' });
  assert.equal(normalizeTree({ type: 'select', onChanged: 'pick' }).type, 'dropdown');
  assert.deepEqual(normalizeTree({ type: 'select', onChanged: 'pick' }).events, { onChange: 'pick' });
});

test('reference field aliases are idempotent with nested values', () => {
  const dumpNode = { type: 'container', props: { decoration: { color: '#AABBCC' }, padding: 4 }, children: [], events: {}, nodeId: 'n0' };
  assert.deepEqual(normalizeTree(dumpNode), dumpNode);
});

test('normalizeTree rejects invalid payloads', () => {
  assert.throws(() => normalizeTree(null), TypeError);
  assert.throws(() => normalizeTree({ children: [] }), TypeError);
  assert.throws(() => normalizeTree({ type: 'x', children: [42] }), TypeError);
});

test('A3: isScrollableType resolves the scroll family; scroll state passes through', () => {
  assert.equal(isScrollableType('scroll'), true);
  assert.equal(isScrollableType('ScrollView'), true);
  assert.equal(isScrollableType('SingleChildScrollView'), true);
  assert.equal(isScrollableType('column'), false);
  assert.equal(isScrollableType('listView'), false);
  const tree = normalizeTree({ type: 'ScrollView', scrollOffset: 120, scrollExtent: 2000, viewportExtent: 400, children: [] });
  assert.equal(tree.type, 'scroll');
  assert.deepEqual(tree.props, { scrollOffset: 120, scrollExtent: 2000, viewportExtent: 400 });
  assert.deepEqual(normalizeTree(tree), tree); // idempotent
});
