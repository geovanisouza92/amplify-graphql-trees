
Reference: https://pt.slideshare.net/billkarwin/models-for-hierarchical-data

### Seed

```graphql
mutation Seed {
  # a: createBranchWithLinks(name: "A") {
  #   id
  #   name
  # }
  #
  # b: createBranchWithLinks(name: "B", ancestorID: a) {
  #   id
  #   name
  # }
  # d: createBranchWithLinks(name: "D", ancestorID: a) {
  #   id
  #   name
  # }
  #
  # c: createBranchWithLinks(name: "C", ancestorID: b) {
  #   id
  #   name
  # }
  # e: createBranchWithLinks(name: "E", ancestorID: d) {
  #   id
  #   name
  # }
  # f: createBranchWithLinks(name: "F", ancestorID: d) {
  #   id
  #   name
  # }
  #
  # g: createBranchWithLinks(name: "G", ancestorID: f) {
  #   id
  #   name
  # }
}
```
