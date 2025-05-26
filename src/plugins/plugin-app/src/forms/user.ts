
import { form } from 'base'

// user create form

function userreg_create_addfields(form, values) {
  form.addField('email', 'email', values.email, 'Email Address used for registration')
}

// user update form

// user view form