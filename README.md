# hefe

[GitHub Pages](https://mercurywave.github.io/hefe/)

## example

```ts
Split("|")
For
    a := Split(",") >> Idx(3)
// Join
b := Sum(a)
Filter
    Split(",") >> Idx(1) >> Contains("foo")
```