
export class form {
  fields
  constructor() {
    this.fields = []
  }
  addField(type, name, value, label, validation, options) {
    this.fields.push({
      type, name, value, label, validation, options
    })
  }
}
