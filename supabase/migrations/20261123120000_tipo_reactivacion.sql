-- Un tipo de movimiento nuevo: `reactivacion`, la vuelta atras de una `baja`.
--
-- Va solo en su archivo porque Postgres no deja USAR un valor de enum en la
-- misma transaccion que lo agrega ("unsafe use of new value"). La migracion
-- siguiente (`dar_de_baja`) lo nombra en un check, asi que necesita que este
-- ya este confirmado.
--
-- Por que un valor propio y no una `baja` con signo positivo: un frasco vacio
-- se da de baja con un movimiento de cero, y reactivarlo tambien es de cero.
-- Con un solo tipo, el trigger tendria que adivinar por el estado actual si un
-- cero es baja o reactivacion, y un doble clic en «Dar de baja» deshacia la
-- baja recien hecha. Con dos tipos, cada renglon dice lo que se quiso hacer.

alter type public.tipo_movimiento add value 'reactivacion';
