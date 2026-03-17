/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')

router.get('/api/test', async ({ request, response }) => {
  const id = request.input('id', '')
  console.log('test endpoint', { id })
  if (request.input('error') === 'true') {
    console.error('test error triggered', { id })
    return response.status(500).json({ error: 'test error', id })
  }
  return response.json({ ok: true, id })
})

router.get('/api/users', async ({ response }) => {
  console.log('fetching users')
  return response.json({ users: ['alice', 'bob', 'charlie'] })
})

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
