# Cloud Functions

Estas funciones son la fuente de verdad de los siete triggers desplegados en
`lingarten-efc0b`. Se recuperaron del artefacto de Cloud Build porque la fuente
original no formaba parte del repositorio.

Las funciones invocables exigen una sesión de Firebase Authentication con el
correo verificado `jersneme6@gmail.com`. Antes de desplegar:

```sh
npm --prefix functions ci
npm --prefix functions run build
firebase deploy --only functions --project lingarten-efc0b
```

Los dos jobs programados conservan sus expresiones cron históricas. Cualquier
cambio de horario o zona horaria es un cambio de negocio y debe decidirse de
forma explícita.
