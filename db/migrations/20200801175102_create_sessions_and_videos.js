exports.up = function(knex) {
  return Promise.all([
    knex.schema.createTable('users', table => {
      table.string('id').unique();
      table.string('username').defaultTo('Anon');
      table.bool('active').defaultTo(true);
      table.bool('isHost').defaultTo(false);
      table.string('session_id');
    }),
    knex.schema.createTable('sessions', table => {
      table.string('id').unique();
      table.string('title');
      table.bool('active').defaultTo(true);
      table.bool('public').notNullable().defaultTo(true);
    }),
    knex.schema.createTable('videos', table => {
      table.increments('id');
      table.string('videoId').unique();
      table.string('url').notNullable();
      table.string('title');
      table.string('thumbnail').notNullable();
      table.string('added_by');
      table.bool('playing');
      table.string('session_id').references('id').inTable('sessions').notNullable();
    })
  ])
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTable('videos'),
    knex.schema.dropTable('users'),
    knex.schema.dropTable('sessions')
  ])
};
